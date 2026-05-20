-- Recall quality tuning: richer hybrid ranking and debug signals.

drop function if exists public.match_memory_chunks(
  extensions.vector,
  uuid,
  text[],
  text[],
  integer,
  double precision,
  public.memory_source_type[],
  timestamp with time zone,
  timestamp with time zone
);

create or replace function public.match_memory_chunks(
  query_embedding extensions.vector(1536),
  target_user_id uuid,
  expanded_terms text[] default null,
  expanded_entities text[] default null,
  match_count int default 10,
  match_threshold float default 0.12,
  filter_source_types public.memory_source_type[] default null,
  filter_start_at timestamptz default null,
  filter_end_at timestamptz default null
)
returns table (
  chunk_id uuid,
  memory_item_id uuid,
  content text,
  chunk_type public.memory_chunk_type,
  source_type public.memory_source_type,
  captured_at timestamptz,
  storage_bucket text,
  storage_path text,
  preview_storage_bucket text,
  preview_storage_path text,
  source_label text,
  vector_similarity float,
  recency_boost float,
  exact_term_boost float,
  exact_entity_boost float,
  image_priority_boost float,
  ocr_confidence_boost float,
  repeated_topic_boost float,
  visual_context_boost float,
  final_score float,
  why_matched_summary text,
  related_candidate_item_ids uuid[],
  metadata jsonb
)
language plpgsql
stable
as $$
begin
  perform set_config('hnsw.ef_search', '96', true);

  return query
  with term_topic_frequency as (
    select
      terms.term,
      count(*)::float as frequency
    from unnest(coalesce(expanded_terms, array[]::text[])) as terms(term)
    join public.memory_chunks c on c.user_id = target_user_id
      and terms.term <> ''
      and c.content ilike ('%' || terms.term || '%')
    join public.memory_items i on i.id = c.memory_item_id
      and i.status <> 'archived'
    group by terms.term
  ),
  candidates as (
    select
      c.*,
      i.source_type,
      i.captured_at,
      i.created_at as item_created_at,
      i.storage_bucket,
      i.storage_path,
      i.preview_storage_bucket as item_preview_storage_bucket,
      i.preview_storage_path as item_preview_storage_path,
      i.source_label as item_source_label,
      i.metadata as item_metadata,
      i.thumbnail_metadata as item_thumbnail_metadata,
      1 - (c.embedding <=> query_embedding) as vector_similarity
    from public.memory_chunks c
    join public.memory_items i on i.id = c.memory_item_id
    where c.user_id = target_user_id
      and c.embedding is not null
      and i.status <> 'archived'
      and (filter_source_types is null or i.source_type = any(filter_source_types))
      and (filter_start_at is null or coalesce(i.captured_at, i.created_at) >= filter_start_at)
      and (filter_end_at is null or coalesce(i.captured_at, i.created_at) <= filter_end_at)
      and 1 - (c.embedding <=> query_embedding) >= coalesce(match_threshold, 0.12)
    order by c.embedding <=> query_embedding
    limit least(greatest(coalesce(match_count, 10) * 6, 40), 240)
  ),
  ranked as (
    select
      c.*,
      case
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '7 days' then 0.06
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '30 days' then 0.035
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '180 days' then 0.012
        else 0
      end as recency_boost,
      case
        when expanded_terms is null then 0
        when exists (
          select 1
          from unnest(expanded_terms) as terms(term)
          where terms.term <> ''
            and c.content ilike ('%' || terms.term || '%')
        ) then 0.09
        else 0
      end as exact_term_boost,
      case
        when expanded_entities is null then 0
        when exists (
          select 1
          from public.memory_chunk_entities ce
          join public.memory_entities e on e.id = ce.memory_entity_id
          where ce.memory_chunk_id = c.id
            and (e.name = any(expanded_entities) or e.normalized_name = any(expanded_entities))
        ) then 0.11
        when exists (
          select 1
          from unnest(expanded_entities) as entities(entity)
          where entities.entity <> ''
            and c.content ilike ('%' || entities.entity || '%')
        ) then 0.075
        else 0
      end as exact_entity_boost,
      case
        when c.source_type in ('screenshot', 'photo') then 0.065
        else 0
      end as image_priority_boost,
      least(
        coalesce(
          nullif(c.retrieval_metadata ->> 'ocr_confidence', '')::float,
          nullif(c.metadata ->> 'ocr_confidence', '')::float,
          nullif(c.retrieval_metadata ->> 'vision_confidence', '')::float,
          c.importance_score,
          0
        ) * 0.04,
        0.04
      ) as ocr_confidence_boost,
      case
        when c.chunk_type = 'visual_summary' then 0.035
        when c.retrieval_metadata ? 'image_first' then 0.025
        else 0
      end as visual_context_boost,
      least(
        coalesce(
          (
            select sum(least(tf.frequency, 8)) * 0.006
            from term_topic_frequency tf
            where c.content ilike ('%' || tf.term || '%')
          ),
          0
        ),
        0.055
      ) as repeated_topic_boost
    from candidates c
  )
  select
    r.id as chunk_id,
    r.memory_item_id,
    r.content,
    r.chunk_type,
    r.source_type,
    r.captured_at,
    r.storage_bucket,
    r.storage_path,
    coalesce(r.preview_storage_bucket, r.item_preview_storage_bucket) as preview_storage_bucket,
    coalesce(r.preview_storage_path, r.item_preview_storage_path, r.storage_path) as preview_storage_path,
    coalesce(r.source_label, r.item_source_label, initcap(r.source_type::text)) as source_label,
    r.vector_similarity,
    r.recency_boost,
    r.exact_term_boost,
    r.exact_entity_boost,
    r.image_priority_boost,
    r.ocr_confidence_boost,
    r.repeated_topic_boost,
    r.visual_context_boost,
    r.vector_similarity
      + r.recency_boost
      + r.exact_term_boost
      + r.exact_entity_boost
      + r.image_priority_boost
      + r.ocr_confidence_boost
      + r.repeated_topic_boost
      + r.visual_context_boost as final_score,
    r.why_matched_summary,
    r.related_candidate_item_ids,
    jsonb_build_object(
      'chunk', r.metadata,
      'retrieval', r.retrieval_metadata,
      'item', r.item_metadata,
      'thumbnail', coalesce(nullif(r.thumbnail_metadata, '{}'::jsonb), r.item_thumbnail_metadata),
      'page_number', r.page_number,
      'image_region', r.image_region,
      'importance_score', r.importance_score,
      'ranking', jsonb_build_object(
        'vector_similarity', r.vector_similarity,
        'recency_boost', r.recency_boost,
        'exact_term_boost', r.exact_term_boost,
        'exact_entity_boost', r.exact_entity_boost,
        'image_priority_boost', r.image_priority_boost,
        'ocr_confidence_boost', r.ocr_confidence_boost,
        'repeated_topic_boost', r.repeated_topic_boost,
        'visual_context_boost', r.visual_context_boost
      ),
      'debug', jsonb_build_object(
        'expanded_terms', expanded_terms,
        'expanded_entities', expanded_entities,
        'matched_terms', (
          select coalesce(jsonb_agg(term), '[]'::jsonb)
          from unnest(coalesce(expanded_terms, array[]::text[])) as terms(term)
          where terms.term <> '' and r.content ilike ('%' || terms.term || '%')
        ),
        'matched_entities', (
          select coalesce(jsonb_agg(entity), '[]'::jsonb)
          from unnest(coalesce(expanded_entities, array[]::text[])) as entities(entity)
          where entities.entity <> '' and r.content ilike ('%' || entities.entity || '%')
        )
      )
    ) as metadata
  from ranked r
  order by final_score desc
  limit least(coalesce(match_count, 10), 50);
end;
$$;

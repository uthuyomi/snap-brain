-- Service-role friendly retrieval RPCs with ranking signals for MVP search UX.

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
  match_threshold float default 0.15,
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
  final_score float,
  why_matched_summary text,
  related_candidate_item_ids uuid[],
  metadata jsonb
)
language plpgsql
stable
as $$
begin
  perform set_config('hnsw.ef_search', '80', true);

  return query
  with candidates as (
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
      and 1 - (c.embedding <=> query_embedding) >= coalesce(match_threshold, 0.15)
    order by c.embedding <=> query_embedding
    limit least(greatest(coalesce(match_count, 10) * 4, 20), 200)
  ),
  ranked as (
    select
      c.*,
      case
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '7 days' then 0.06
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '30 days' then 0.03
        when coalesce(c.captured_at, c.item_created_at) > now() - interval '180 days' then 0.01
        else 0
      end as recency_boost,
      case
        when expanded_terms is null then 0
        when exists (
          select 1
          from unnest(expanded_terms) as terms(term)
          where terms.term <> ''
            and c.content ilike ('%' || terms.term || '%')
        ) then 0.08
        else 0
      end as exact_term_boost,
      case
        when expanded_entities is null then 0
        when exists (
          select 1
          from public.memory_chunk_entities ce
          join public.memory_entities e on e.id = ce.memory_entity_id
          where ce.memory_chunk_id = c.id
            and (
              e.name = any(expanded_entities)
              or e.normalized_name = any(expanded_entities)
            )
        ) then 0.1
        when exists (
          select 1
          from unnest(expanded_entities) as entities(entity)
          where entities.entity <> ''
            and c.content ilike ('%' || entities.entity || '%')
        ) then 0.07
        else 0
      end as exact_entity_boost,
      case
        when c.source_type in ('screenshot', 'photo') then 0.05
        else 0
      end as image_priority_boost
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
    r.vector_similarity + r.recency_boost + r.exact_term_boost + r.exact_entity_boost + r.image_priority_boost as final_score,
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
        'image_priority_boost', r.image_priority_boost
      )
    ) as metadata
  from ranked r
  order by final_score desc
  limit least(coalesce(match_count, 10), 50);
end;
$$;

drop function if exists public.find_related_memory_candidates(
  uuid,
  uuid,
  text[],
  text[],
  integer
);

create or replace function public.find_related_memory_candidates(
  anchor_chunk_id uuid,
  target_user_id uuid,
  expanded_terms text[] default null,
  expanded_entities text[] default null,
  match_count int default 5
)
returns table (
  chunk_id uuid,
  memory_item_id uuid,
  content text,
  chunk_type public.memory_chunk_type,
  source_type public.memory_source_type,
  captured_at timestamptz,
  source_label text,
  preview_storage_path text,
  similarity float,
  relation_reason text
)
language plpgsql
stable
as $$
declare
  anchor_embedding extensions.vector(1536);
  anchor_item_id uuid;
  anchor_captured_at timestamptz;
  anchor_tags text[];
begin
  perform set_config('hnsw.ef_search', '80', true);

  select
    c.embedding,
    c.memory_item_id,
    coalesce(i.captured_at, i.created_at),
    array(
      select jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb))
    )
  into anchor_embedding, anchor_item_id, anchor_captured_at, anchor_tags
  from public.memory_chunks c
  join public.memory_items i on i.id = c.memory_item_id
  where c.id = anchor_chunk_id
    and c.user_id = target_user_id
    and c.embedding is not null;

  if anchor_embedding is null then
    return;
  end if;

  return query
  select
    c.id as chunk_id,
    c.memory_item_id,
    c.content,
    c.chunk_type,
    i.source_type,
    i.captured_at,
    coalesce(c.source_label, i.source_label, initcap(i.source_type::text)) as source_label,
    coalesce(c.preview_storage_path, i.preview_storage_path, i.storage_path) as preview_storage_path,
    1 - (c.embedding <=> anchor_embedding) as similarity,
    case
      when expanded_terms is not null and exists (
        select 1 from unnest(expanded_terms) as terms(term)
        where terms.term <> '' and c.content ilike ('%' || terms.term || '%')
      ) then 'shares expanded query terms'
      when expanded_entities is not null and exists (
        select 1
        from public.memory_chunk_entities ce
        join public.memory_entities e on e.id = ce.memory_entity_id
        where ce.memory_chunk_id = c.id
          and (e.name = any(expanded_entities) or e.normalized_name = any(expanded_entities))
      ) then 'shares extracted entities'
      when anchor_tags is not null and exists (
        select 1
        from jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb)) as tag(value)
        where tag.value = any(anchor_tags)
      ) then 'shares memory tags'
      when abs(extract(epoch from (coalesce(i.captured_at, i.created_at) - anchor_captured_at))) < 86400
        then 'captured around the same time'
      when i.source_type in ('screenshot', 'photo') then 'visually searchable memory nearby'
      else 'nearby semantic memory'
    end as relation_reason
  from public.memory_chunks c
  join public.memory_items i on i.id = c.memory_item_id
  where c.user_id = target_user_id
    and c.embedding is not null
    and i.status <> 'archived'
    and c.memory_item_id <> anchor_item_id
  order by
    (1 - (c.embedding <=> anchor_embedding))
    + case
        when expanded_terms is not null and exists (
          select 1 from unnest(expanded_terms) as terms(term)
          where terms.term <> '' and c.content ilike ('%' || terms.term || '%')
        ) then 0.05
        when expanded_entities is not null and exists (
          select 1
          from public.memory_chunk_entities ce
          join public.memory_entities e on e.id = ce.memory_entity_id
          where ce.memory_chunk_id = c.id
            and (e.name = any(expanded_entities) or e.normalized_name = any(expanded_entities))
        ) then 0.05
        when anchor_tags is not null and exists (
          select 1
          from jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb)) as tag(value)
          where tag.value = any(anchor_tags)
        ) then 0.04
        else 0
      end desc
  limit least(coalesce(match_count, 5), 20);
end;
$$;

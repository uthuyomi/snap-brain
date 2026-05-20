-- Personalized Recall Layer: quiet user-specific ranking signals and lightweight reflection snapshots.

alter table public.memory_items
  add column if not exists memory_importance_score real not null default 0,
  add column if not exists related_retrieval_count integer not null default 0,
  add column if not exists last_related_at timestamptz;

alter table public.memory_interactions
  add column if not exists session_id text,
  add column if not exists previous_memory_id uuid references public.memory_items(id) on delete set null,
  add column if not exists interaction_sequence integer;

create index if not exists memory_interactions_session_idx
  on public.memory_interactions (user_id, session_id, interaction_sequence, created_at)
  where session_id is not null;

create index if not exists memory_items_importance_idx
  on public.memory_items (user_id, memory_importance_score desc, last_opened_at desc nulls last);

create table if not exists public.user_memory_patterns (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  top_topics text[] not null default '{}'::text[],
  active_contexts text[] not null default '{}'::text[],
  recent_focus text[] not null default '{}'::text[],
  recurring_entities text[] not null default '{}'::text[],
  suggested_queries text[] not null default '{}'::text[],
  frequently_recalled_item_ids uuid[] not null default '{}'::uuid[],
  forgotten_candidate_item_ids uuid[] not null default '{}'::uuid[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

alter table public.user_memory_patterns enable row level security;

create policy "user_memory_patterns_own_all"
  on public.user_memory_patterns for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_memory_patterns_updated_at on public.user_memory_patterns;
create trigger set_user_memory_patterns_updated_at
before update on public.user_memory_patterns
for each row execute function public.set_updated_at();

drop function if exists public.record_memory_open(uuid, uuid);
drop function if exists public.record_memory_open(uuid, uuid, text, uuid);
create function public.record_memory_open(
  target_user_id uuid,
  target_item_id uuid,
  interaction_session_id text default null,
  previous_item_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
begin
  if interaction_session_id is not null then
    select coalesce(max(interaction_sequence), 0) + 1
    into next_sequence
    from public.memory_interactions
    where user_id = target_user_id
      and session_id = interaction_session_id;
  end if;

  update public.memory_items
  set
    open_count = open_count + 1,
    last_opened_at = now(),
    memory_importance_score = least(
      1,
      memory_importance_score + 0.035
        + case when is_favorite then 0.02 else 0 end
        + case when is_pinned then 0.035 else 0 end
    )
  where id = target_item_id
    and user_id = target_user_id;

  insert into public.memory_interactions (
    user_id,
    memory_item_id,
    interaction_type,
    session_id,
    previous_memory_id,
    interaction_sequence
  )
  values (
    target_user_id,
    target_item_id,
    'open',
    interaction_session_id,
    previous_item_id,
    next_sequence
  );
end;
$$;

drop function if exists public.record_memory_search_hits(uuid, uuid[], text);
drop function if exists public.record_memory_search_hits(uuid, uuid[], text, text);
create function public.record_memory_search_hits(
  target_user_id uuid,
  target_item_ids uuid[],
  search_query text,
  interaction_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
begin
  if interaction_session_id is not null then
    select coalesce(max(interaction_sequence), 0) + 1
    into next_sequence
    from public.memory_interactions
    where user_id = target_user_id
      and session_id = interaction_session_id;
  end if;

  update public.memory_items
  set
    search_hit_count = search_hit_count + 1,
    last_search_hit_at = now(),
    memory_importance_score = least(
      1,
      memory_importance_score + 0.015
        + case when is_favorite then 0.015 else 0 end
        + case when is_pinned then 0.025 else 0 end
    )
  where user_id = target_user_id
    and id = any(target_item_ids);

  insert into public.memory_interactions (
    user_id,
    memory_item_id,
    interaction_type,
    query,
    session_id,
    interaction_sequence
  )
  select target_user_id, item_id, 'search_hit', search_query, interaction_session_id, next_sequence
  from unnest(target_item_ids) as item_id;
end;
$$;

drop function if exists public.refresh_user_memory_patterns(uuid);
drop function if exists public.record_memory_related_retrieval(uuid, uuid[]);
create function public.record_memory_related_retrieval(target_user_id uuid, target_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memory_items
  set
    related_retrieval_count = related_retrieval_count + 1,
    last_related_at = now(),
    memory_importance_score = least(1, memory_importance_score + 0.008)
  where user_id = target_user_id
    and id = any(target_item_ids);
end;
$$;

create function public.refresh_user_memory_patterns(target_user_id uuid)
returns public.user_memory_patterns
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.user_memory_patterns;
  topic_terms text[];
  context_terms text[];
  recurring_terms text[];
  suggested text[];
  frequent_items uuid[];
  forgotten_items uuid[];
begin
  with recent_terms as (
    select lower(term) as term, count(*) as frequency
    from public.memory_interactions mi
    join public.memory_chunks c on c.memory_item_id = mi.memory_item_id and c.user_id = mi.user_id
    cross join lateral unnest(
      regexp_split_to_array(
        regexp_replace(coalesce(mi.query, '') || ' ' || coalesce(c.source_label, '') || ' ' || coalesce(c.content, ''), '[^[:alnum:]ぁ-んァ-ン一-龥]+', ' ', 'g'),
        '\s+'
      )
    ) as term
    where mi.user_id = target_user_id
      and mi.created_at > now() - interval '30 days'
      and length(term) >= 2
      and lower(term) not in ('source', 'visible', 'text', 'tags', 'the', 'and', 'for', 'with', 'this', 'that')
    group by lower(term)
    order by frequency desc, term
    limit 12
  )
  select coalesce(array_agg(term), '{}'::text[])
  into topic_terms
  from recent_terms;

  with active as (
    select coalesce(mi.query, c.source_label, i.source_label, i.source_type::text) as context, count(*) as frequency
    from public.memory_interactions mi
    join public.memory_items i on i.id = mi.memory_item_id
    left join public.memory_chunks c on c.memory_item_id = i.id and c.chunk_type = 'semantic_summary'
    where mi.user_id = target_user_id
      and mi.created_at > now() - interval '14 days'
    group by context
    order by frequency desc, context
    limit 8
  )
  select coalesce(array_agg(context), '{}'::text[])
  into context_terms
  from active
  where context is not null and context <> '';

  with entities as (
    select e.name, count(*) as frequency
    from public.memory_interactions mi
    join public.memory_chunks c on c.memory_item_id = mi.memory_item_id
    join public.memory_chunk_entities ce on ce.memory_chunk_id = c.id
    join public.memory_entities e on e.id = ce.memory_entity_id
    where mi.user_id = target_user_id
      and mi.created_at > now() - interval '30 days'
    group by e.name
    order by frequency desc, e.name
    limit 12
  )
  select coalesce(array_agg(name), '{}'::text[])
  into recurring_terms
  from entities;

  suggested := (
    select coalesce(array_agg(distinct suggestion), '{}'::text[])
    from (
      select unnest(topic_terms[1:6]) as suggestion
      union all
      select unnest(recurring_terms[1:4]) as suggestion
      union all
      select unnest(context_terms[1:4]) as suggestion
    ) s
    where suggestion is not null and suggestion <> ''
  );

  select coalesce(array_agg(id), '{}'::uuid[])
  into frequent_items
  from (
    select id
    from public.memory_items
    where user_id = target_user_id
      and status <> 'archived'
    order by
      (open_count * 2 + search_hit_count + related_retrieval_count) desc,
      last_opened_at desc nulls last
    limit 12
  ) ranked;

  select coalesce(array_agg(id), '{}'::uuid[])
  into forgotten_items
  from (
    select id
    from public.memory_items
    where user_id = target_user_id
      and status = 'ready'
      and is_pinned = false
      and is_favorite = false
      and open_count = 0
      and search_hit_count = 0
      and created_at < now() - interval '14 days'
    order by created_at desc
    limit 12
  ) forgotten;

  insert into public.user_memory_patterns (
    user_id,
    snapshot_date,
    top_topics,
    active_contexts,
    recent_focus,
    recurring_entities,
    suggested_queries,
    frequently_recalled_item_ids,
    forgotten_candidate_item_ids,
    metadata
  )
  values (
    target_user_id,
    current_date,
    coalesce(topic_terms, '{}'::text[]),
    coalesce(context_terms, '{}'::text[]),
    coalesce(topic_terms[1:5], '{}'::text[]),
    coalesce(recurring_terms, '{}'::text[]),
    coalesce(suggested[1:8], '{}'::text[]),
    coalesce(frequent_items, '{}'::uuid[]),
    coalesce(forgotten_items, '{}'::uuid[]),
    jsonb_build_object('generated_by', 'lightweight_reflection_v1')
  )
  on conflict (user_id, snapshot_date) do update
  set
    top_topics = excluded.top_topics,
    active_contexts = excluded.active_contexts,
    recent_focus = excluded.recent_focus,
    recurring_entities = excluded.recurring_entities,
    suggested_queries = excluded.suggested_queries,
    frequently_recalled_item_ids = excluded.frequently_recalled_item_ids,
    forgotten_candidate_item_ids = excluded.forgotten_candidate_item_ids,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into snapshot;

  return snapshot;
end;
$$;

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
  personal_importance_boost float,
  favorite_boost float,
  pinned_boost float,
  interaction_boost float,
  topic_affinity_boost float,
  final_score float,
  why_matched_summary text,
  related_candidate_item_ids uuid[],
  metadata jsonb
)
language plpgsql
stable
as $$
begin
  perform set_config('hnsw.ef_search', '112', true);

  return query
  with latest_pattern as (
    select *
    from public.user_memory_patterns
    where user_id = target_user_id
    order by snapshot_date desc, created_at desc
    limit 1
  ),
  term_topic_frequency as (
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
      i.is_favorite,
      i.is_pinned,
      i.open_count,
      i.search_hit_count,
      i.related_retrieval_count,
      i.last_opened_at,
      i.last_search_hit_at,
      i.memory_importance_score,
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
    limit least(greatest(coalesce(match_count, 10) * 8, 60), 300)
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
      case when c.source_type in ('screenshot', 'photo') then 0.065 else 0 end as image_priority_boost,
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
      ) as repeated_topic_boost,
      least(coalesce(c.memory_importance_score, 0) * 0.09, 0.09) as personal_importance_boost,
      case when c.is_favorite then 0.06 else 0 end as favorite_boost,
      case when c.is_pinned then 0.085 else 0 end as pinned_boost,
      least(
        (ln(1 + greatest(c.open_count, 0)) * 0.018)
        + (ln(1 + greatest(c.search_hit_count, 0)) * 0.012)
        + (ln(1 + greatest(c.related_retrieval_count, 0)) * 0.008)
        + case when c.last_opened_at > now() - interval '7 days' then 0.035 else 0 end
        + case when c.last_search_hit_at > now() - interval '7 days' then 0.02 else 0 end,
        0.11
      ) as interaction_boost,
      least(
        coalesce(
          (
            select count(*) * 0.018
            from latest_pattern lp,
              unnest(coalesce(lp.top_topics, '{}'::text[]) || coalesce(lp.recent_focus, '{}'::text[]) || coalesce(lp.recurring_entities, '{}'::text[])) as topic(term)
            where topic.term <> ''
              and c.content ilike ('%' || topic.term || '%')
          ),
          0
        ),
        0.09
      ) as topic_affinity_boost
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
    r.personal_importance_boost,
    r.favorite_boost,
    r.pinned_boost,
    r.interaction_boost,
    r.topic_affinity_boost,
    r.vector_similarity
      + r.recency_boost
      + r.exact_term_boost
      + r.exact_entity_boost
      + r.image_priority_boost
      + r.ocr_confidence_boost
      + r.repeated_topic_boost
      + r.visual_context_boost
      + r.personal_importance_boost
      + r.favorite_boost
      + r.pinned_boost
      + r.interaction_boost
      + r.topic_affinity_boost as final_score,
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
      'personal', jsonb_build_object(
        'open_count', r.open_count,
        'search_hit_count', r.search_hit_count,
        'related_retrieval_count', r.related_retrieval_count,
        'memory_importance_score', r.memory_importance_score,
        'is_favorite', r.is_favorite,
        'is_pinned', r.is_pinned,
        'last_opened_at', r.last_opened_at,
        'last_search_hit_at', r.last_search_hit_at
      ),
      'ranking', jsonb_build_object(
        'vector_similarity', r.vector_similarity,
        'recency_boost', r.recency_boost,
        'exact_term_boost', r.exact_term_boost,
        'exact_entity_boost', r.exact_entity_boost,
        'image_priority_boost', r.image_priority_boost,
        'ocr_confidence_boost', r.ocr_confidence_boost,
        'repeated_topic_boost', r.repeated_topic_boost,
        'visual_context_boost', r.visual_context_boost,
        'personal_importance_boost', r.personal_importance_boost,
        'favorite_boost', r.favorite_boost,
        'pinned_boost', r.pinned_boost,
        'interaction_boost', r.interaction_boost,
        'topic_affinity_boost', r.topic_affinity_boost
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

drop function if exists public.find_related_memory_candidates(uuid, uuid, text[], text[], integer);

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
  perform set_config('hnsw.ef_search', '96', true);

  select
    c.embedding,
    c.memory_item_id,
    coalesce(i.captured_at, i.created_at),
    array(select jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb)))
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
  with chain_counts as (
    select
      case
        when mi.memory_item_id = anchor_item_id then mi.previous_memory_id
        when mi.previous_memory_id = anchor_item_id then mi.memory_item_id
      end as related_item_id,
      count(*)::float as chain_frequency
    from public.memory_interactions mi
    where mi.user_id = target_user_id
      and (mi.memory_item_id = anchor_item_id or mi.previous_memory_id = anchor_item_id)
    group by related_item_id
  )
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
      when coalesce(cc.chain_frequency, 0) > 0 then 'same recall path'
      when abs(extract(epoch from (coalesce(i.captured_at, i.created_at) - anchor_captured_at))) < 86400 then 'saved around the same time'
      when anchor_tags is not null and exists (
        select 1
        from jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb)) as tag(value)
        where tag.value = any(anchor_tags)
      ) then 'shares memory tags'
      when i.source_type in ('screenshot', 'photo') and i.source_type = (
        select source_type from public.memory_items where id = anchor_item_id
      ) then 'same visual source type'
      else 'nearby semantic memory'
    end as relation_reason
  from public.memory_chunks c
  join public.memory_items i on i.id = c.memory_item_id
  left join chain_counts cc on cc.related_item_id = c.memory_item_id
  where c.user_id = target_user_id
    and c.embedding is not null
    and i.status <> 'archived'
    and c.memory_item_id <> anchor_item_id
  order by
    (1 - (c.embedding <=> anchor_embedding))
    + least(coalesce(cc.chain_frequency, 0) * 0.03, 0.12)
    + least(coalesce(i.memory_importance_score, 0) * 0.05, 0.05)
    + case when i.is_favorite then 0.035 else 0 end
    + case when i.is_pinned then 0.045 else 0 end
    + case when abs(extract(epoch from (coalesce(i.captured_at, i.created_at) - anchor_captured_at))) < 86400 then 0.04 else 0 end
    desc
  limit least(coalesce(match_count, 5), 20);
end;
$$;

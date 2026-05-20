-- Recall interaction actions: record quiet user actions that make recall more personal.

alter table public.memory_interactions
  drop constraint if exists memory_interactions_type_check;

alter table public.memory_interactions
  add constraint memory_interactions_type_check check (
    interaction_type in (
      'open',
      'search_hit',
      'related_retrieval',
      'search_open',
      'related_open',
      'favorite',
      'unfavorite',
      'favorite_added',
      'favorite_removed',
      'pin',
      'unpin',
      'pinned',
      'unpinned',
      'archive',
      'restore',
      'archived',
      'deleted'
    )
  );

drop function if exists public.record_memory_action(uuid, uuid, text, text, text, uuid, jsonb);
create function public.record_memory_action(
  target_user_id uuid,
  target_item_id uuid,
  action_type text,
  search_query text default null,
  interaction_session_id text default null,
  previous_item_id uuid default null,
  action_metadata jsonb default '{}'::jsonb
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

  insert into public.memory_interactions (
    user_id,
    memory_item_id,
    interaction_type,
    query,
    session_id,
    previous_memory_id,
    interaction_sequence,
    metadata
  )
  values (
    target_user_id,
    target_item_id,
    action_type,
    search_query,
    interaction_session_id,
    previous_item_id,
    next_sequence,
    coalesce(action_metadata, '{}'::jsonb)
  );

  update public.memory_items
  set memory_importance_score = greatest(0, least(
    1,
    memory_importance_score
      + case
        when action_type in ('favorite_added', 'favorite') then 0.08
        when action_type in ('pinned', 'pin') then 0.11
        when action_type in ('search_open') then 0.045
        when action_type in ('related_open') then 0.035
        when action_type in ('favorite_removed', 'unfavorite') then -0.025
        when action_type in ('unpinned', 'unpin') then -0.035
        when action_type in ('archived', 'archive', 'deleted') then -0.08
        else 0.01
      end
  ))
  where id = target_item_id
    and user_id = target_user_id;
end;
$$;

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
  anchor_source_type public.memory_source_type;
  anchor_tags text[];
  anchor_entities text[];
begin
  perform set_config('hnsw.ef_search', '112', true);

  select
    c.embedding,
    c.memory_item_id,
    coalesce(i.captured_at, i.created_at),
    i.source_type,
    array(select jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb))),
    array(
      select e.normalized_name
      from public.memory_chunk_entities ce
      join public.memory_entities e on e.id = ce.memory_entity_id
      where ce.memory_chunk_id = c.id
    )
  into anchor_embedding, anchor_item_id, anchor_captured_at, anchor_source_type, anchor_tags, anchor_entities
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
  ),
  scored as (
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
      coalesce(cc.chain_frequency, 0) as chain_frequency,
      case
        when abs(extract(epoch from (coalesce(i.captured_at, i.created_at) - anchor_captured_at))) < 86400 then 1
        else 0
      end as time_close,
      case when i.source_type = anchor_source_type and i.source_type in ('screenshot', 'photo') then 1 else 0 end as same_visual_source,
      (
        select count(*)
        from jsonb_array_elements_text(coalesce(c.retrieval_metadata -> 'tags', '[]'::jsonb)) as tag(value)
        where anchor_tags is not null and tag.value = any(anchor_tags)
      ) as tag_overlap,
      (
        select count(*)
        from public.memory_chunk_entities ce
        join public.memory_entities e on e.id = ce.memory_entity_id
        where ce.memory_chunk_id = c.id
          and anchor_entities is not null
          and e.normalized_name = any(anchor_entities)
      ) as entity_overlap,
      (
        select count(*)
        from unnest(coalesce(expanded_terms, array[]::text[])) as terms(term)
        where terms.term <> '' and c.content ilike ('%' || terms.term || '%')
      ) as expanded_term_overlap,
      (
        select count(*)
        from unnest(coalesce(expanded_entities, array[]::text[])) as entities(entity)
        where entities.entity <> '' and c.content ilike ('%' || entities.entity || '%')
      ) as expanded_entity_overlap,
      i.memory_importance_score,
      i.is_favorite,
      i.is_pinned,
      i.last_opened_at
    from public.memory_chunks c
    join public.memory_items i on i.id = c.memory_item_id
    left join chain_counts cc on cc.related_item_id = c.memory_item_id
    where c.user_id = target_user_id
      and c.embedding is not null
      and i.status <> 'archived'
      and c.memory_item_id <> anchor_item_id
    order by c.embedding <=> anchor_embedding
    limit 120
  )
  select
    s.chunk_id,
    s.memory_item_id,
    s.content,
    s.chunk_type,
    s.source_type,
    s.captured_at,
    s.source_label,
    s.preview_storage_path,
    s.similarity,
    case
      when s.chain_frequency > 0 then 'same recall path'
      when s.entity_overlap > 0 or s.expanded_entity_overlap > 0 then 'shares memory tags'
      when s.tag_overlap > 0 or s.expanded_term_overlap > 0 then 'shares memory tags'
      when s.time_close > 0 then 'saved around the same time'
      when s.same_visual_source > 0 then 'same visual source type'
      else 'nearby semantic memory'
    end as relation_reason
  from scored s
  order by
    s.similarity
    + least(s.chain_frequency * 0.04, 0.16)
    + least((s.tag_overlap + s.expanded_term_overlap) * 0.025, 0.12)
    + least((s.entity_overlap + s.expanded_entity_overlap) * 0.04, 0.16)
    + case when s.time_close > 0 then 0.045 else 0 end
    + case when s.same_visual_source > 0 then 0.035 else 0 end
    + least(coalesce(s.memory_importance_score, 0) * 0.06, 0.06)
    + case when s.is_favorite then 0.035 else 0 end
    + case when s.is_pinned then 0.045 else 0 end
    + case when s.last_opened_at > now() - interval '14 days' then 0.035 else 0 end
    desc
  limit least(coalesce(match_count, 5), 20);
end;
$$;

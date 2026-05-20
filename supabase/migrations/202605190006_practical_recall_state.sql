-- Practical recall signals: lightweight user state and interaction history.

alter table public.memory_items
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists open_count integer not null default 0,
  add column if not exists search_hit_count integer not null default 0,
  add column if not exists last_opened_at timestamptz,
  add column if not exists last_search_hit_at timestamptz;

create table if not exists public.memory_interactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_item_id uuid not null references public.memory_items(id) on delete cascade,
  interaction_type text not null,
  query text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint memory_interactions_type_check check (
    interaction_type in ('open', 'search_hit', 'favorite', 'unfavorite', 'pin', 'unpin', 'archive', 'restore')
  )
);

create index if not exists memory_items_user_pinned_idx
  on public.memory_items (user_id, is_pinned desc, is_favorite desc, updated_at desc);

create index if not exists memory_items_interaction_score_idx
  on public.memory_items (user_id, open_count desc, search_hit_count desc, last_opened_at desc nulls last);

create index if not exists memory_interactions_user_item_idx
  on public.memory_interactions (user_id, memory_item_id, created_at desc);

create index if not exists memory_interactions_user_type_idx
  on public.memory_interactions (user_id, interaction_type, created_at desc);

alter table public.memory_interactions enable row level security;

create policy "memory_interactions_own_all"
  on public.memory_interactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop function if exists public.record_memory_open(uuid, uuid);
create function public.record_memory_open(target_user_id uuid, target_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memory_items
  set
    open_count = open_count + 1,
    last_opened_at = now()
  where id = target_item_id
    and user_id = target_user_id;

  insert into public.memory_interactions (user_id, memory_item_id, interaction_type)
  values (target_user_id, target_item_id, 'open');
end;
$$;

drop function if exists public.record_memory_search_hits(uuid, uuid[], text);
create function public.record_memory_search_hits(target_user_id uuid, target_item_ids uuid[], search_query text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memory_items
  set
    search_hit_count = search_hit_count + 1,
    last_search_hit_at = now()
  where user_id = target_user_id
    and id = any(target_item_ids);

  insert into public.memory_interactions (user_id, memory_item_id, interaction_type, query)
  select target_user_id, item_id, 'search_hit', search_query
  from unnest(target_item_ids) as item_id;
end;
$$;

-- SnapBrain MVP memory ingestion schema.
-- Requires Supabase Postgres with pgvector enabled.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.memory_source_type as enum (
    'screenshot',
    'photo',
    'pdf',
    'note',
    'file',
    'web',
    'unknown'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.memory_input_modality as enum (
    'image',
    'pdf',
    'text',
    'mixed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.memory_item_status as enum (
    'pending',
    'processing',
    'ready',
    'failed',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ingestion_job_status as enum (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ingestion_stage as enum (
    'queued',
    'detecting',
    'extracting',
    'normalizing',
    'chunking',
    'embedding',
    'organizing',
    'done',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.memory_chunk_type as enum (
    'ocr_text',
    'visual_summary',
    'semantic_summary',
    'entity_context',
    'page_section',
    'note'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.memory_entity_type as enum (
    'person',
    'organization',
    'place',
    'product',
    'app',
    'project',
    'date',
    'identifier',
    'tag',
    'unknown'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type public.memory_source_type not null default 'unknown',
  input_modality public.memory_input_modality not null,
  title text,
  raw_text text,
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  byte_size bigint,
  checksum_sha256 text,
  captured_at timestamptz,
  status public.memory_item_status not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_items_raw_input_check check (
    raw_text is not null or (storage_bucket is not null and storage_path is not null)
  )
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_item_id uuid not null references public.memory_items(id) on delete cascade,
  status public.ingestion_job_status not null default 'queued',
  stage public.ingestion_stage not null default 'queued',
  pipeline_version text not null default 'ingestion-v1',
  extraction_version text,
  chunking_version text,
  embedding_model text,
  embedding_dimensions integer,
  vision_model text,
  prompt_version text,
  attempt integer not null default 1,
  idempotency_key text,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  usage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_item_id, pipeline_version, attempt),
  unique (user_id, idempotency_key)
);

create table if not exists public.memory_extractions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_item_id uuid not null references public.memory_items(id) on delete cascade,
  ingestion_job_id uuid references public.ingestion_jobs(id) on delete set null,
  extraction_version text not null default 'extract-v1',
  extractor text not null,
  model text,
  prompt_version text,
  language text,
  visible_text text,
  visual_summary text,
  normalized_text text,
  structured jsonb not null default '{}'::jsonb,
  confidence real,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_item_id, extraction_version)
);

create table if not exists public.memory_chunks (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_item_id uuid not null references public.memory_items(id) on delete cascade,
  extraction_id uuid references public.memory_extractions(id) on delete set null,
  chunk_index integer not null,
  chunk_type public.memory_chunk_type not null,
  content text not null,
  content_hash text not null,
  token_count integer,
  source_start integer,
  source_end integer,
  page_number integer,
  image_region jsonb,
  importance_score real not null default 0,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_dimensions integer not null default 1536,
  embedding_hash text,
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(content, ''))
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_item_id, chunk_index, content_hash)
);

create table if not exists public.memory_entities (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type public.memory_entity_type not null default 'unknown',
  name text not null,
  normalized_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, normalized_name)
);

create table if not exists public.memory_chunk_entities (
  memory_chunk_id uuid not null references public.memory_chunks(id) on delete cascade,
  memory_entity_id uuid not null references public.memory_entities(id) on delete cascade,
  confidence real,
  created_at timestamptz not null default now(),
  primary key (memory_chunk_id, memory_entity_id)
);

create table if not exists public.memory_links (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_item_id uuid references public.memory_items(id) on delete cascade,
  target_item_id uuid references public.memory_items(id) on delete cascade,
  source_chunk_id uuid references public.memory_chunks(id) on delete cascade,
  target_chunk_id uuid references public.memory_chunks(id) on delete cascade,
  relation_type text not null,
  confidence real,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint memory_links_has_source check (source_item_id is not null or source_chunk_id is not null),
  constraint memory_links_has_target check (target_item_id is not null or target_chunk_id is not null)
);

create table if not exists public.reflection_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.ingestion_job_status not null default 'queued',
  reflection_type text not null,
  model text,
  prompt_version text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_reflections (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reflection_run_id uuid references public.reflection_runs(id) on delete set null,
  reflection_type text not null,
  title text,
  content text not null,
  source_item_ids uuid[] not null default '{}'::uuid[],
  source_chunk_ids uuid[] not null default '{}'::uuid[],
  confidence real,
  valid_from timestamptz,
  valid_until timestamptz,
  superseded_by uuid references public.memory_reflections(id) on delete set null,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_dimensions integer not null default 1536,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memory_items_user_status_idx
  on public.memory_items (user_id, status, created_at desc);

create index if not exists memory_items_user_captured_idx
  on public.memory_items (user_id, captured_at desc nulls last);

create index if not exists memory_items_checksum_idx
  on public.memory_items (user_id, checksum_sha256)
  where checksum_sha256 is not null;

create index if not exists ingestion_jobs_item_idx
  on public.ingestion_jobs (memory_item_id, created_at desc);

create index if not exists memory_extractions_item_idx
  on public.memory_extractions (memory_item_id, created_at desc);

create index if not exists memory_chunks_item_idx
  on public.memory_chunks (memory_item_id, chunk_index);

create index if not exists memory_chunks_user_type_idx
  on public.memory_chunks (user_id, chunk_type, created_at desc);

create index if not exists memory_chunks_search_idx
  on public.memory_chunks using gin (search_tsv);

create index if not exists memory_chunks_embedding_hnsw_idx
  on public.memory_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists memory_entities_lookup_idx
  on public.memory_entities (user_id, entity_type, normalized_name);

create index if not exists memory_reflections_embedding_hnsw_idx
  on public.memory_reflections
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists set_memory_items_updated_at on public.memory_items;
create trigger set_memory_items_updated_at
before update on public.memory_items
for each row execute function public.set_updated_at();

drop trigger if exists set_ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger set_ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_extractions_updated_at on public.memory_extractions;
create trigger set_memory_extractions_updated_at
before update on public.memory_extractions
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_chunks_updated_at on public.memory_chunks;
create trigger set_memory_chunks_updated_at
before update on public.memory_chunks
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_entities_updated_at on public.memory_entities;
create trigger set_memory_entities_updated_at
before update on public.memory_entities
for each row execute function public.set_updated_at();

drop trigger if exists set_reflection_runs_updated_at on public.reflection_runs;
create trigger set_reflection_runs_updated_at
before update on public.reflection_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_reflections_updated_at on public.memory_reflections;
create trigger set_memory_reflections_updated_at
before update on public.memory_reflections
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.memory_items enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.memory_extractions enable row level security;
alter table public.memory_chunks enable row level security;
alter table public.memory_entities enable row level security;
alter table public.memory_chunk_entities enable row level security;
alter table public.memory_links enable row level security;
alter table public.reflection_runs enable row level security;
alter table public.memory_reflections enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "memory_items_own_all"
  on public.memory_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ingestion_jobs_own_all"
  on public.ingestion_jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memory_extractions_own_all"
  on public.memory_extractions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memory_chunks_own_all"
  on public.memory_chunks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memory_entities_own_all"
  on public.memory_entities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memory_chunk_entities_own_all"
  on public.memory_chunk_entities for all
  using (
    exists (
      select 1
      from public.memory_chunks c
      where c.id = memory_chunk_entities.memory_chunk_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.memory_chunks c
      join public.memory_entities e on e.id = memory_chunk_entities.memory_entity_id
      where c.id = memory_chunk_entities.memory_chunk_id
        and c.user_id = auth.uid()
        and e.user_id = auth.uid()
    )
  );

create policy "memory_links_own_all"
  on public.memory_links for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reflection_runs_own_all"
  on public.reflection_runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memory_reflections_own_all"
  on public.memory_reflections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-objects',
  'memory-objects',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'application/pdf',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;

create policy "memory_objects_select_own"
  on storage.objects for select
  using (
    bucket_id = 'memory-objects'
    and owner = auth.uid()
  );

create policy "memory_objects_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'memory-objects'
    and owner = auth.uid()
  );

create policy "memory_objects_update_own"
  on storage.objects for update
  using (
    bucket_id = 'memory-objects'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'memory-objects'
    and owner = auth.uid()
  );

create policy "memory_objects_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'memory-objects'
    and owner = auth.uid()
  );

create or replace function public.match_memory_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 10,
  match_threshold float default 0.2,
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
  similarity float,
  metadata jsonb
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.memory_item_id,
    c.content,
    c.chunk_type,
    i.source_type,
    i.captured_at,
    i.storage_bucket,
    i.storage_path,
    1 - (c.embedding <=> query_embedding) as similarity,
    jsonb_build_object(
      'chunk', c.metadata,
      'item', i.metadata,
      'page_number', c.page_number,
      'image_region', c.image_region,
      'importance_score', c.importance_score
    ) as metadata
  from public.memory_chunks c
  join public.memory_items i on i.id = c.memory_item_id
  where c.user_id = auth.uid()
    and c.embedding is not null
    and (filter_source_types is null or i.source_type = any(filter_source_types))
    and (filter_start_at is null or coalesce(i.captured_at, i.created_at) >= filter_start_at)
    and (filter_end_at is null or coalesce(i.captured_at, i.created_at) <= filter_end_at)
    and 1 - (c.embedding <=> query_embedding) >= coalesce(match_threshold, 0.2)
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 10), 50);
$$;

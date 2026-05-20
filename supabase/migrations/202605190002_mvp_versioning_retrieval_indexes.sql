-- SnapBrain MVP tuning: version tracking, retrieval UX metadata, and vector index tuning.

alter table public.memory_items
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists source_label text,
  add column if not exists thumbnail_metadata jsonb not null default '{}'::jsonb;

alter table public.ingestion_jobs
  add column if not exists chunker_version text,
  add column if not exists embedding_version text,
  add column if not exists extraction_schema_version text;

update public.ingestion_jobs
set chunker_version = coalesce(chunker_version, chunking_version)
where chunker_version is null
  and chunking_version is not null;

alter table public.memory_extractions
  add column if not exists pipeline_version text,
  add column if not exists extraction_schema_version text not null default 'memory-extraction-v1',
  add column if not exists normalization_version text,
  add column if not exists normalized jsonb not null default '{}'::jsonb;

alter table public.memory_chunks
  add column if not exists pipeline_version text,
  add column if not exists prompt_version text,
  add column if not exists chunker_version text not null default 'chunker-v1',
  add column if not exists embedding_version text not null default 'embedding-v1',
  add column if not exists extraction_schema_version text,
  add column if not exists source_label text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists thumbnail_metadata jsonb not null default '{}'::jsonb,
  add column if not exists why_matched_summary text,
  add column if not exists related_candidate_item_ids uuid[] not null default '{}'::uuid[],
  add column if not exists retrieval_metadata jsonb not null default '{}'::jsonb;

alter table public.memory_links
  add column if not exists is_system_generated boolean not null default true,
  add column if not exists link_strength real,
  add column if not exists expires_at timestamptz;

comment on table public.memory_links is
  'Optional derived graph data. MVP retrieval should generate related memories dynamically and avoid strong links during normal save.';

comment on column public.memory_chunks.why_matched_summary is
  'Disposable retrieval explanation seed. Query-specific why_matched text should normally be generated at retrieval time.';

comment on column public.memory_chunks.related_candidate_item_ids is
  'Disposable cached related-memory candidates, not durable graph truth.';

create index if not exists memory_items_source_label_idx
  on public.memory_items (user_id, source_label)
  where source_label is not null;

create index if not exists memory_chunks_related_candidates_gin_idx
  on public.memory_chunks using gin (related_candidate_item_ids);

create index if not exists memory_chunks_retrieval_metadata_gin_idx
  on public.memory_chunks using gin (retrieval_metadata);

drop index if exists public.memory_chunks_embedding_hnsw_idx;
create index memory_chunks_embedding_hnsw_idx
  on public.memory_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;

drop index if exists public.memory_reflections_embedding_hnsw_idx;
create index memory_reflections_embedding_hnsw_idx
  on public.memory_reflections
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;

-- IVFFlat can be benchmarked later after enough chunks exist.
-- Recommended starting point for 100k+ chunks:
-- create index concurrently memory_chunks_embedding_ivfflat_idx
--   on public.memory_chunks
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100)
--   where embedding is not null;
-- Query sessions can then tune recall/speed with: set local ivfflat.probes = 10;

drop function if exists public.match_memory_chunks(
  extensions.vector,
  integer,
  double precision,
  public.memory_source_type[],
  timestamp with time zone,
  timestamp with time zone
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
  preview_storage_bucket text,
  preview_storage_path text,
  source_label text,
  similarity float,
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
  select
    c.id as chunk_id,
    c.memory_item_id,
    c.content,
    c.chunk_type,
    i.source_type,
    i.captured_at,
    i.storage_bucket,
    i.storage_path,
    coalesce(c.preview_storage_bucket, i.preview_storage_bucket) as preview_storage_bucket,
    coalesce(c.preview_storage_path, i.preview_storage_path, i.storage_path) as preview_storage_path,
    coalesce(c.source_label, i.source_label, initcap(i.source_type::text)) as source_label,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.why_matched_summary,
    c.related_candidate_item_ids,
    jsonb_build_object(
      'chunk', c.metadata,
      'retrieval', c.retrieval_metadata,
      'item', i.metadata,
      'thumbnail', coalesce(nullif(c.thumbnail_metadata, '{}'::jsonb), i.thumbnail_metadata),
      'page_number', c.page_number,
      'image_region', c.image_region,
      'importance_score', c.importance_score,
      'versions', jsonb_build_object(
        'pipeline_version', c.pipeline_version,
        'prompt_version', c.prompt_version,
        'chunker_version', c.chunker_version,
        'embedding_version', c.embedding_version,
        'extraction_schema_version', c.extraction_schema_version,
        'embedding_model', c.embedding_model
      )
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
end;
$$;

drop function if exists public.find_related_memory_candidates(
  uuid,
  integer
);

create or replace function public.find_related_memory_candidates(
  anchor_chunk_id uuid,
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
  similarity float
)
language plpgsql
stable
as $$
declare
  anchor_embedding extensions.vector(1536);
  anchor_item_id uuid;
begin
  perform set_config('hnsw.ef_search', '80', true);

  select c.embedding, c.memory_item_id
  into anchor_embedding, anchor_item_id
  from public.memory_chunks c
  where c.id = anchor_chunk_id
    and c.user_id = auth.uid()
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
    1 - (c.embedding <=> anchor_embedding) as similarity
  from public.memory_chunks c
  join public.memory_items i on i.id = c.memory_item_id
  where c.user_id = auth.uid()
    and c.embedding is not null
    and c.memory_item_id <> anchor_item_id
  order by c.embedding <=> anchor_embedding
  limit least(coalesce(match_count, 5), 20);
end;
$$;

# SnapBrain MVP Architecture

SnapBrain is an AI memory organization layer, not an AI persona. Screenshots, photos, notes, and PDFs are dropped in with minimal friction, then AI extracts, organizes, embeds, and retrieves them later through natural language.

The MVP should prioritize ingestion correctness and reprocessability over UI polish. Raw inputs must be preserved, every AI output should be traceable to its source, and searchable memory chunks should be replaceable when extraction, chunking, or embedding logic improves.

## Core Principles

- **Rough input first**: accept messy images, screenshots, PDFs, and plain notes without requiring users to classify them up front.
- **Image-first memory**: screenshots and photos are first-class records, not attachments to text.
- **Lossless raw storage**: original files and note text are stored before any AI processing.
- **Derived memory is disposable**: OCR, vision summaries, chunks, embeddings, and reflections can be regenerated.
- **RAG-ready by default**: every searchable chunk carries an embedding, source metadata, timestamps, and modality hints.
- **Ingestion correctness first**: extraction, validation, and version tracking matter more than generating clever summaries.
- **OpenAI only**: all AI extraction and embedding calls go through the OpenAI abstraction layer.
- **FastAPI as AI context engine**: FastAPI owns ingestion, extraction, chunking, embeddings, retrieval, and future reflection jobs.
- **Reflection-ready later**: long-term summaries, inferred topics, relationships, and recurring patterns live in separate tables so they do not corrupt raw memories.

## System Shape

```text
Next.js App Router
  -> FastAPI ingestion API
    -> Supabase Storage: original files
    -> Supabase Postgres: ingestion item + job
      -> background worker
        -> OpenAI Vision / extraction
        -> normalization
        -> chunking
        -> OpenAI embeddings
        -> pgvector memory_chunks
```

Initial services:

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui.
- **Backend**: FastAPI for upload, ingestion status, and search APIs.
- **Database**: Supabase Postgres with pgvector.
- **Storage**: Supabase Storage bucket `memory-objects` for original files.
- **AI provider**: OpenAI only.
- **Embedding model**: `text-embedding-3-large` with `dimensions=1536` to match the current pgvector schema.
- **Vision/OCR**: `gpt-5.2` through the Responses API abstraction.

OpenAI docs note: OpenAI's latest-model guide currently recommends `gpt-5.2` as the best general-purpose model, with improved multimodality including vision. The model list describes `text-embedding-3-large` as the most capable embedding model. SnapBrain keeps embedding dimensions at 1536 so the current pgvector schema remains stable. See:

- https://platform.openai.com/docs/guides/embeddings
- https://platform.openai.com/docs/models/text-embedding-3-large
- https://platform.openai.com/docs/guides/images-vision
- https://platform.openai.com/docs/api-reference/responses
- https://platform.openai.com/docs/guides/latest-model

## Supabase Table Design

### `profiles`

Application user profile row keyed by Supabase Auth user id.

Purpose:

- Gives every memory row a stable `user_id`.
- Keeps app-level user metadata separate from auth.

### `memory_items`

One raw user submission: screenshot, photo, PDF, text note, link snapshot later, or mixed upload later.

Purpose:

- Stores original object metadata.
- Tracks ingestion status at item level.
- Provides a stable parent for extraction artifacts and chunks.

Important fields:

- `source_type`: `screenshot`, `photo`, `pdf`, `note`, `file`, `web`, `unknown`.
- `input_modality`: `image`, `pdf`, `text`, `mixed`.
- `storage_bucket`, `storage_path`: original file location for non-text inputs.
- `raw_text`: original note text when no file is uploaded.
- `captured_at`: user/event time when known.
- `status`: `pending`, `processing`, `ready`, `failed`, `archived`.
- `preview_storage_path`: canonical preview image when the original is a PDF or non-previewable file.
- `source_label`: user-facing source label such as `Screenshot`, `PDF`, `Chrome`, `Slack`, or `Manual note`.
- `metadata`: device/app/page count/image dimensions/etc.

### `ingestion_jobs`

Processing attempts for one `memory_item`.

Purpose:

- Enables retries without losing history.
- Records which pipeline version and AI models produced derived data.
- Makes failures debuggable.

Version fields:

- `pipeline_version`
- `prompt_version`
- `chunker_version`
- `embedding_version`
- `extraction_schema_version`

### `memory_extractions`

AI and parser outputs derived from a raw item.

Purpose:

- Keeps raw extracted text, vision summary, OCR text, document structure, and AI tags separate from final chunks.
- Allows future chunking/embedding changes without rerunning expensive vision extraction.

For image-first ingestion, this table should store both:

- Literal text visible in the image.
- Visual description: UI state, objects, people, places, layout, logos, inferred task context.

Extraction rows store `extraction_schema_version`, `prompt_version`, and `model` so derived data can be traced and regenerated safely.

### `memory_chunks`

Searchable units used by RAG.

Purpose:

- Holds normalized text for retrieval.
- Stores `embedding vector(1536)` from `text-embedding-3-large` using the API `dimensions` parameter.
- Carries enough source metadata to show citations and thumbnails later.
- Stores retrieval UX metadata such as `source_label`, `preview_storage_path`, `why_matched`, and `related_candidate_item_ids`.

MVP chunk examples:

- Screenshot visible text chunk.
- Screenshot visual context chunk.
- Note paragraph chunk.
- AI-normalized "memory statement" chunk.

MVP chunk types:

- `ocr_text`: literal visible text, PDF text, or direct note text.
- `semantic_summary`: compact normalized memory statement.
- `visual_summary`: image/screenshot-only visual context.

Future chunk types such as `entity_context` and `page_section` can remain in schema but should not be produced by the MVP pipeline unless a later migration enables them.

### `memory_entities` and `memory_chunk_entities`

Extracted people, organizations, places, products, apps, projects, dates, and tags.

Purpose:

- Supports filtering and faceted retrieval.
- Gives reflection jobs structured signals.
- Avoids baking entity assumptions only into chunk text.

### `memory_links`

Relations between items or chunks.

Purpose:

- Optional relation storage for reflection and later graph expansion.
- Search-time related memories should be generated dynamically from vector similarity, keyword overlap, entity overlap, and recency.
- Useful later for graph-style recall and reflection.

MVP policy:

- Do not create strong links during normal save.
- Only write links for explicit user actions or low-risk system facts such as exact duplicate checksum.
- Treat `memory_links` as optional derived graph data.

### `reflection_runs` and `memory_reflections`

Future long-term synthesis layer.

Purpose:

- Summaries, patterns, inferred projects, recurring interests, and periodic digests.
- Kept separate from raw chunks so reflections can be changed or deleted without damaging source memories.

## FastAPI Directory Structure

```text
backend/
  app/
    main.py
    core/
      config.py
      logging.py
      security.py
    api/
      deps.py
      routes/
        health.py
        ingestion.py
        search.py
        memories.py
    db/
      supabase.py
      postgres.py
      repositories/
        memory_items.py
        ingestion_jobs.py
        memory_extractions.py
        memory_chunks.py
    schemas/
      ingestion.py
      search.py
      memory.py
      openai.py
    services/
      storage/
        supabase_storage.py
      openai/
        client.py
        embeddings.py
        vision.py
        structured_outputs.py
      ingestion/
        pipeline.py
        detectors.py
        extractors.py
        normalizer.py
        chunker.py
        embedder.py
        organizer.py
      retrieval/
        hybrid_search.py
        reranker.py
        context_builder.py
    workers/
      ingestion_worker.py
      reflection_worker.py
    tests/
      test_chunker.py
      test_ingestion_pipeline.py
      test_search.py
```

MVP can run the worker in-process with FastAPI background tasks or a simple command runner. Keep the worker boundary explicit so it can move to Celery, RQ, Dramatiq, or Supabase Edge Functions later.

## Ingestion Pipeline

### 1. Intake

Endpoint:

```text
POST /api/ingestion/items
```

Accept:

- Multipart file upload for screenshots, photos, PDFs, and generic files.
- JSON body for text notes.
- Optional metadata: `captured_at`, `source_app`, `device`, `timezone`, `user_tags`.

Actions:

1. Validate auth.
2. Store original file in Supabase Storage if present.
3. Create `memory_items` row with `status = pending`.
4. Create `ingestion_jobs` row with `stage = queued`.
5. Return item id and job id immediately.

### 2. Detection

Determine:

- MIME type.
- Source type hint.
- Input modality.
- Page count for PDF.
- Image dimensions and hash.
- Duplicate candidates by checksum.

The pipeline should still process duplicates unless the duplicate policy says otherwise. For memory systems, duplicate screenshots can be meaningful because time and context matter.

### 3. Extraction

By modality:

- **Image/screenshot/photo**: call OpenAI vision extraction with strict structured output.
- **PDF**: extract machine text when available, render pages or selected previews for vision when text is missing or layout matters.
- **Text note**: normalize directly, optionally enrich with structure.

Image extraction should ask for structured output:

- `visible_text`
- `visual_summary`
- `likely_context`
- `entities`
- `tags`
- `time_hints`
- `action_items`
- `confidence`

The OpenAI layer returns typed Pydantic objects. Routes and repositories never save raw model output until validation succeeds.

Screenshots should be treated as memory-rich UI evidence:

- app or website name
- visible page title
- selected item
- error messages
- buttons/actions visible
- dates and identifiers
- code snippets or table content

### 4. Normalization

Create a canonical textual representation for search:

```text
Source: screenshot
Captured at: 2026-05-19T...
Visible text: ...
Visual context: ...
Entities: ...
Tags: ...
Why this may matter: ...
```

The normalized text is not a user-facing summary. It is retrieval fuel.

### 5. Chunking

Generate chunks from `memory_extractions`, not directly from raw files.

MVP chunk types:

- `ocr_text`: literal visible or document text.
- `visual_summary`: scene/UI description.
- `semantic_summary`: concise memory statement.

Deferred chunk types:

- `entity_context`: entity-rich chunk for names/projects/dates.
- `page_section`: PDF page or section.
- `note`: can be represented as `ocr_text` in MVP unless we need note-specific ranking.

Each chunk stores:

- `chunk_index`
- `chunk_type`
- `content`
- `content_hash`
- `token_count`
- `source_offsets` or page/image region metadata when available.
- `importance_score`
- `metadata`
- `source_label`
- `preview_storage_path`
- `thumbnail_metadata`
- `related_candidate_item_ids`

### 6. Embedding

Embed only the final chunk `content`, not the whole extraction JSON.

Default strategy:

- Model: `text-embedding-3-large`.
- Dimensions: 1536.
- Store vector on `memory_chunks.embedding`.
- Store `embedding_model`, `embedding_dimensions`, and `embedding_hash`.
- Store `embedding_version`.
- Skip re-embedding if `(embedding_model, embedding_dimensions, content_hash)` is unchanged.

The embedding input should include compact source context when helpful:

```text
[screenshot][Slack][2026-05-19]
Visible text and normalized chunk content...
```

Do not include private implementation metadata, raw JSON noise, or long unrelated page text in every chunk.

### 7. Organization

After chunks are embedded:

- Insert extracted entities.
- Link chunks to entities.
- Add optional item-level title and AI tags.
- Mark item `ready`.

Organization should be best-effort. A failed tag extraction should not block OCR/searchable chunks. Strong related-memory links are not created by default in MVP.

## Memory Chunking Design

Chunking should be modality-aware instead of a single fixed splitter, but MVP must keep the number of chunks small to control embedding cost.

### Notes

- Produce `ocr_text` chunks from the user-authored text.
- Produce one `semantic_summary` chunk when the note is long or context-rich.
- Split by heading and paragraph only when needed.
- Merge tiny paragraphs into nearby context.
- Target 300-700 tokens.
- Overlap only when continuity matters.

### PDFs

- Produce `ocr_text` chunks from extracted machine text.
- Produce one `semantic_summary` chunk for the whole document or per major section.
- Avoid `page_section` chunks in MVP unless the PDF is too large to retrieve coherently.
- Preserve page numbers in metadata.
- Generate a short page summary chunk for visually scanned pages.

### Screenshots and Photos

Create at least two chunks:

1. Literal visible text chunk.
2. Semantic summary chunk.

For image/screenshot inputs, optionally create:

- `visual_summary` chunk when visual context matters.

This is important because natural-language recall may ask either:

- "What was that error about?"
- "Find the screenshot with the blue dashboard."
- "Where did I see Alice's invoice number?"

## RAG Search Design

Use hybrid retrieval:

1. Embed the natural-language query.
2. Expand fuzzy query terms with a small OpenAI Structured Output call.
3. Vector search against `memory_chunks.embedding`.
4. Full-text / exact term signals against chunk content.
5. Optional filters: modality, source type, entity, time range, tags.
6. Rank with vector similarity, recency boost, exact entity/term boost, and screenshot/image priority.
7. Generate `why_matched` from retrieval signals.
8. Dynamically fetch related memory candidates.
9. Build answer context with chunk content, source item metadata, thumbnail metadata, and storage preview URL.

Minimal retrieval request:

```json
{
  "query": "前のRouteSnap広告案"
}
```

Minimal retrieval response should include:

- `content`
- `short_summary`
- `metadata.item`
- `why_matched`
- `preview_path`
- `thumbnail`
- `captured_at`
- `source_type`
- `score`
- `ranking_signals`
- `related`

Initial RPC:

```sql
match_memory_chunks(
  query_embedding vector(1536),
  match_count int,
  match_threshold float,
  filter_source_types text[],
  filter_start_at timestamptz,
  filter_end_at timestamptz
)
```

Later, add:

- cross-encoder or LLM reranking
- recency boost
- entity exact-match boost
- duplicate grouping
- "memory trail" expansion through optional `memory_links`

### Related Memory Retrieval

Related memories are generated at query time for MVP.

Signals:

- nearest neighboring chunks around the winning result
- same source type or source app
- close `captured_at` window
- shared checksum for exact duplicates
- shared extracted entities or tags when available
- shared expanded query terms

The resulting candidate item ids can be returned in the API response and cached into `memory_chunks.related_candidate_item_ids` only as disposable retrieval metadata. They should not become durable graph truth.

### Vector Index Strategy

Use cosine distance for all chunk embeddings.

Primary index:

```sql
create index memory_chunks_embedding_hnsw_idx
on public.memory_chunks
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64)
where embedding is not null;
```

Runtime tuning:

```sql
set local hnsw.ef_search = 80;
```

For very large deployments, an IVFFlat index can be tested after enough rows exist:

```sql
create index memory_chunks_embedding_ivfflat_idx
on public.memory_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

set local ivfflat.probes = 10;
```

HNSW is the default MVP choice because it does not require a training-sized dataset before index creation and has strong recall for incremental growth.

### Query Expansion Layer

Query expansion is deliberately small and non-agentic.

Input:

```text
配送LPのやつ
```

Possible expansion:

```json
{
  "expanded_query": "配送 LP RouteSnap 広告 UI delivery landing page",
  "terms": ["配送", "LP", "RouteSnap", "広告", "UI", "delivery", "landing page"],
  "entities": ["RouteSnap"],
  "intent_summary": "Find a previous delivery landing page or ad memory."
}
```

Rules:

- Use OpenAI Structured Outputs.
- Fall back to deterministic domain hints when the query expansion call fails.
- Do not run a multi-step agent.
- Embed the expanded query, but keep the original query in the response.

## OpenAI API Abstraction Layer

Keep OpenAI usage behind interfaces so prompts, response schemas, and model names are not scattered through routes.

Recommended modules:

- `services/openai/client.py`: constructs the OpenAI SDK client, timeout, retries, logging redaction.
- `services/openai/embeddings.py`: `embed_texts(texts: list[str]) -> list[EmbeddingResult]`.
- `services/openai/vision.py`: `extract_image_memory(...) -> ImageExtraction`.
- `services/openai/structured_outputs.py`: shared JSON schema helpers and validation.

Rules:

- Routes never call OpenAI directly.
- Pipeline stages receive typed service interfaces.
- Store model name, prompt version, schema version, and token usage on `ingestion_jobs` or `memory_extractions`.
- Treat AI outputs as untrusted: validate with Pydantic before saving.
- Make all AI calls idempotent around item id, extraction version, and content hash.
- Use strict JSON schema / Structured Outputs for vision extraction and normalization.
- Persist validated objects only after Pydantic validation.

Core Pydantic objects:

- `VisionExtraction`: visible text, visual summary, likely context, tags, entities, time hints, action items, confidence.
- `NormalizedMemory`: source label, title, normalized summary, retrieval text, importance, thumbnail metadata.
- `MemoryChunkDraft`: chunk type, content, source offsets, page number, image region, retrieval metadata.
- `EmbeddingResult`: model, dimensions, vector, embedding hash, usage.

Suggested configuration:

```text
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_EMBEDDING_DIMENSIONS=1536
OPENAI_VISION_MODEL=gpt-5.2
OPENAI_QUERY_MODEL=gpt-5.2
OPENAI_REQUEST_TIMEOUT_SECONDS=60
```

The specific vision model should remain a config value. The database stores the actual model used per extraction so future migrations can compare output quality.

## Reflection-Ready Extension Points

Reflection is not required for MVP, but the schema should avoid painting us into a corner.

Future jobs can:

- Build daily or weekly memory summaries.
- Detect projects from repeated entities and screenshots.
- Merge near-duplicate memories into episodes.
- Create "things I seem to care about" summaries.
- Generate reminders from action items.

Design guardrails:

- Reflections reference source chunks through `source_chunk_ids`.
- Reflections have their own embeddings, model versions, and confidence.
- Reflections can expire or be superseded.
- Reflections never overwrite raw item extraction.
- User feedback can downrank or delete reflections without deleting source memories.

## MVP API Surface

```text
GET  /health
POST /api/ingestion/items
GET  /api/ingestion/items/{item_id}
GET  /api/ingestion/jobs/{job_id}
POST /api/search
GET  /api/memories/{item_id}
```

## Authentication

SnapBrain uses Supabase Auth with Google OAuth for MVP user isolation.

Frontend:

- `@supabase/ssr` manages browser/server sessions.
- Google sign-in redirects to `/auth/callback`.
- Frontend API calls send `Authorization: Bearer <supabase_access_token>`.

Backend:

- FastAPI verifies the bearer token with Supabase Auth.
- The verified Supabase user id becomes `user_id` for ingestion and retrieval.
- The old `X-User-Id` development header is disabled by default and only works when `ALLOW_DEV_USER_HEADER=true`.

Required environment:

```text
backend/.env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
FRONTEND_ORIGIN=http://127.0.0.1:3001

frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Supabase dashboard setup:

- Enable Google provider in Authentication > Providers.
- Add the Google OAuth client id and secret.
- Add frontend callback URL to allowed redirect URLs:
  - `http://127.0.0.1:3001/auth/callback`
  - production equivalent later.

`POST /api/search` should accept:

```json
{
  "query": "あの請求書番号が写ってたスクショを探して",
  "source_types": ["screenshot", "photo", "pdf", "note"],
  "start_at": null,
  "end_at": null,
  "limit": 10
}
```

Return chunks with source item metadata:

```json
{
  "query": "前のRouteSnap広告案",
  "expanded_query": "前のRouteSnap広告案 RouteSnap 広告 LP UI",
  "expanded_terms": ["前のRouteSnap広告案", "RouteSnap", "広告", "LP", "UI"],
  "results": [
    {
      "chunk_id": "...",
      "item_id": "...",
      "score": 0.83,
      "source_type": "screenshot",
      "chunk_type": "semantic_summary",
      "source_label": "RouteSnap広告スクショ",
      "content": "...",
      "short_summary": "...",
      "captured_at": "...",
      "preview_path": "...",
      "thumbnail": {},
      "why_matched": "RouteSnap広告スクショ: semantic match; mentions RouteSnap, 広告; image-first memory.",
      "ranking_signals": {
        "vector_similarity": 0.78,
        "recency_boost": 0.03,
        "exact_term_boost": 0.08,
        "exact_entity_boost": 0.07,
        "image_priority_boost": 0.05
      },
      "related": [
        {
          "chunk_id": "...",
          "item_id": "...",
          "source_label": "Plain text memo",
          "similarity": 0.74,
          "relation_reason": "shares expanded query terms"
        }
      ]
    }
  ]
}
```

## Minimal Test Dataset

Seed script:

```text
backend/scripts/seed_memory_dataset.py --user-id <supabase-auth-user-uuid>
```

It ingests:

- RouteSnap広告スクショ
- Stripe error screenshot
- Twitter screenshot
- PDF note
- plain text memo

This dataset is designed to test whether queries like `前のRouteSnap広告案`, `配送LPのやつ`, and `Stripeのエラー` return memories with useful previews, reasons, and related candidates.

## Recall Quality Tuning

Recall quality is tuned with real ingestion data, not only mock UI data.

Required environment:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

E2E verification:

```text
cd backend
python scripts/verify_recall_e2e.py --user-id <supabase-auth-user-uuid>
```

This verifies:

- screenshot upload to Supabase Storage
- OpenAI Vision extraction
- normalization
- chunking
- embeddings
- pgvector save
- retrieval through the hybrid search layer

Recall benchmark:

```text
cd backend
python scripts/recall_benchmark.py --user-id <supabase-auth-user-uuid>
```

Internal UI playground:

```text
http://127.0.0.1:3001/playground
```

The playground shows:

- query expansion terms
- retrieved memories
- vector similarity
- rerank score
- boost signals
- why matched
- related memories

Current hybrid ranking signals:

- vector similarity
- recency boost
- screenshot/image boost
- exact expanded term boost
- exact entity boost
- OCR / vision confidence boost
- repeated topic frequency boost
- visual context boost

The ranking goal is not to prove the model is clever. It is to make `前に見たアレ` surface the most recall-like memory first.

## Implementation Order

1. Apply Supabase migration.
2. Create FastAPI skeleton.
3. Implement upload intake.
4. Implement OpenAI Vision extraction.
5. Implement normalization.
6. Implement chunking.
7. Implement embeddings.
8. Implement vector search.
9. Implement related memory retrieval.
10. Add minimal search UI.
11. Add reflection worker stub.

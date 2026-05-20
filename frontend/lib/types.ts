export type SourceType = "screenshot" | "photo" | "pdf" | "note" | "file" | "web" | "unknown";

export type Memory = {
  id: string;
  title: string;
  shortSummary: string;
  tags: string[];
  sourceType: SourceType;
  sourceLabel: string;
  capturedAt: string;
  previewPath?: string;
  previewUrl?: string;
  originalUrl?: string;
  thumbnailTone: "blue" | "slate" | "indigo" | "zinc";
  ocrText?: string;
  aiSummary?: string;
  todos?: string[];
  entities?: string[];
  relatedIds?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  status?: string;
  openCount?: number;
  searchHitCount?: number;
  relationReason?: string;
};

export type MemoryPattern = {
  top_topics?: string[];
  active_contexts?: string[];
  recent_focus?: string[];
  recurring_entities?: string[];
  suggested_queries?: string[];
  frequently_recalled_item_ids?: string[];
  forgotten_candidate_item_ids?: string[];
};

export type MemoryItemRow = {
  id: string;
  title?: string | null;
  source_type: SourceType;
  source_label?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  preview_storage_path?: string | null;
  preview_url?: string | null;
  original_url?: string | null;
  storage_path?: string | null;
  thumbnail_metadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  open_count?: number;
  search_hit_count?: number;
  relation_reason?: string;
  chunks?: MemoryChunkRow[];
};

export type MemoryChunkRow = {
  id: string;
  chunk_type: string;
  content: string;
  source_label?: string | null;
  preview_storage_path?: string | null;
  retrieval_metadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type RelatedMemory = {
  chunk_id: string;
  item_id: string;
  source_label?: string;
  source_type?: SourceType;
  preview_path?: string;
  similarity: number;
  relation_reason?: string;
  content_preview?: string;
};

export type SearchResult = {
  chunk_id: string;
  item_id: string;
  score: number;
  source_type: SourceType;
  chunk_type: string;
  source_label?: string;
  content: string;
  short_summary?: string;
  captured_at?: string;
  preview_path?: string;
  preview_url?: string;
  thumbnail?: Record<string, unknown>;
  why_matched?: string;
  personal_context?: string[];
  related?: RelatedMemory[];
  ranking_signals?: Record<string, number>;
  debug?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type SearchResponse = {
  query: string;
  expanded_query?: string;
  expanded_terms?: string[];
  expanded_entities?: string[];
  recall_summary?: string;
  results: SearchResult[];
};

export type PlaygroundResponse = {
  cases: Array<{
    query: string;
    response: SearchResponse;
  }>;
};

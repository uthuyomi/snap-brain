import type { Memory, MemoryChunkRow, MemoryItemRow } from "./types";

export function toMemory(row: MemoryItemRow, chunks: MemoryChunkRow[] = []): Memory {
  const metadata = row.metadata ?? {};
  const title = row.title || row.source_label || labelFromSource(row.source_type);
  const summaryChunk =
    chunks.find((chunk) => chunk.chunk_type === "semantic_summary") ??
    chunks.find((chunk) => chunk.chunk_type === "visual_summary") ??
    chunks[0];
  const ocrChunk = chunks.find((chunk) => chunk.chunk_type === "ocr_text");
  const retrieval = (summaryChunk?.retrieval_metadata ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(retrieval.tags)
    ? retrieval.tags.map(String)
    : Array.isArray(metadata.tags)
      ? metadata.tags.map(String)
      : [];

  return {
    id: row.id,
    title,
    shortSummary: String(retrieval.short_ai_summary ?? summaryChunk?.content ?? "AI整理待ちの記憶です。"),
    tags,
    sourceType: row.source_type,
    sourceLabel: row.source_label || labelFromSource(row.source_type),
    capturedAt: row.captured_at || row.created_at || "",
    previewPath: row.preview_storage_path || row.storage_path || undefined,
    previewUrl: row.preview_url || undefined,
    originalUrl: row.original_url || row.preview_url || undefined,
    thumbnailTone:
      row.source_type === "screenshot" || row.source_type === "photo"
        ? "blue"
        : row.source_type === "pdf"
          ? "zinc"
          : "slate",
    ocrText: ocrChunk?.content,
    aiSummary: String(retrieval.short_ai_summary ?? summaryChunk?.content ?? ""),
    todos: Array.isArray(metadata.todos) ? metadata.todos.map(String) : [],
    entities: Array.isArray(metadata.entities) ? metadata.entities.map(String) : [],
    relatedIds: [],
    isFavorite: row.is_favorite ?? false,
    isPinned: row.is_pinned ?? false,
    status: row.status,
    openCount: row.open_count ?? 0,
    searchHitCount: row.search_hit_count ?? 0,
    relationReason: row.relation_reason,
  };
}

function labelFromSource(sourceType: string) {
  switch (sourceType) {
    case "screenshot":
      return "Screenshot";
    case "photo":
      return "Photo";
    case "pdf":
      return "PDF";
    case "note":
      return "Memo";
    default:
      return "Memory";
  }
}

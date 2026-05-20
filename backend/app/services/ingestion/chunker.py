from app.core.config import Settings
from app.schemas.memory import InputModality, MemoryChunkType
from app.schemas.openai import MemoryChunkDraft, NormalizedMemory, VisionExtraction


class MemoryChunker:
    def __init__(self, settings: Settings):
        self.settings = settings

    def build_chunks(
        self,
        *,
        input_modality: InputModality,
        normalized: NormalizedMemory,
        extraction: VisionExtraction | None,
        preview_storage_path: str | None,
    ) -> list[MemoryChunkDraft]:
        chunks: list[MemoryChunkDraft] = []

        ocr_content = extraction.visible_text if extraction else normalized.retrieval_text
        if ocr_content.strip():
            chunks.append(
                MemoryChunkDraft(
                    chunk_index=len(chunks),
                    chunk_type=MemoryChunkType.ocr_text,
                    content=ocr_content,
                    importance_score=normalized.importance_score,
                    source_label=normalized.source_label,
                    preview_storage_path=preview_storage_path,
                    thumbnail_metadata=normalized.thumbnail_metadata,
                    retrieval_metadata={
                        "mvp_chunk": True,
                        "short_ai_summary": normalized.normalized_summary,
                        "tags": normalized.tags,
                        "ocr_confidence": normalized.importance_score,
                        "vision_confidence": normalized.importance_score,
                    },
                )
            )

        if normalized.normalized_summary.strip():
            chunks.append(
                MemoryChunkDraft(
                    chunk_index=len(chunks),
                    chunk_type=MemoryChunkType.semantic_summary,
                    content=normalized.retrieval_text,
                    importance_score=normalized.importance_score,
                    source_label=normalized.source_label,
                    preview_storage_path=preview_storage_path,
                    thumbnail_metadata=normalized.thumbnail_metadata,
                    retrieval_metadata={
                        "mvp_chunk": True,
                        "short_ai_summary": normalized.normalized_summary,
                        "tags": normalized.tags,
                        "ocr_confidence": normalized.importance_score,
                        "vision_confidence": normalized.importance_score,
                    },
                )
            )

        if input_modality == InputModality.image and extraction and extraction.visual_summary.strip():
            chunks.append(
                MemoryChunkDraft(
                    chunk_index=len(chunks),
                    chunk_type=MemoryChunkType.visual_summary,
                    content=extraction.visual_summary,
                    importance_score=normalized.importance_score,
                    source_label=normalized.source_label,
                    preview_storage_path=preview_storage_path,
                    thumbnail_metadata=normalized.thumbnail_metadata,
                    retrieval_metadata={
                        "mvp_chunk": True,
                        "image_first": True,
                        "short_ai_summary": normalized.normalized_summary,
                        "tags": normalized.tags,
                        "ocr_confidence": normalized.importance_score,
                        "vision_confidence": normalized.importance_score,
                    },
                )
            )

        return chunks

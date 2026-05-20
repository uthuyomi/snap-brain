from supabase import Client

from app.core.config import Settings
from app.schemas.openai import EmbeddingResult, MemoryChunkDraft
from app.schemas.search import SearchRequest


class MemoryChunksRepository:
    def __init__(self, client: Client):
        self.client = client
        self.public_select = (
            "id,user_id,memory_item_id,extraction_id,chunk_index,chunk_type,content,"
            "source_label,preview_storage_path,thumbnail_metadata,retrieval_metadata,metadata,"
            "page_number,image_region,importance_score,created_at"
        )

    def create_many(
        self,
        *,
        settings: Settings,
        user_id: str,
        memory_item_id: str,
        extraction_id: str,
        chunks: list[MemoryChunkDraft],
        embeddings: list[EmbeddingResult],
    ) -> list[dict]:
        rows = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            rows.append(
                {
                    "user_id": user_id,
                    "memory_item_id": memory_item_id,
                    "extraction_id": extraction_id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_type": chunk.chunk_type.value,
                    "content": chunk.content,
                    "content_hash": embedding.embedding_hash,
                    "token_count": None,
                    "source_start": chunk.source_start,
                    "source_end": chunk.source_end,
                    "page_number": chunk.page_number,
                    "image_region": chunk.image_region.model_dump(mode="json") if chunk.image_region else None,
                    "importance_score": chunk.importance_score,
                    "embedding": self._vector_literal(embedding.vector),
                    "embedding_model": embedding.model,
                    "embedding_dimensions": embedding.dimensions,
                    "embedding_hash": embedding.embedding_hash,
                    "pipeline_version": settings.pipeline_version,
                    "prompt_version": settings.prompt_version,
                    "chunker_version": settings.chunker_version,
                    "embedding_version": settings.embedding_version,
                    "extraction_schema_version": settings.extraction_schema_version,
                    "source_label": chunk.source_label,
                    "preview_storage_path": chunk.preview_storage_path,
                    "thumbnail_metadata": chunk.thumbnail_metadata,
                    "retrieval_metadata": chunk.retrieval_metadata,
                    "metadata": {},
                }
            )

        response = self.client.table("memory_chunks").insert(rows).execute()
        return response.data

    def list_for_item(self, *, user_id: str, item_id: str) -> list[dict]:
        response = (
            self.client.table("memory_chunks")
            .select(self.public_select)
            .eq("user_id", user_id)
            .eq("memory_item_id", item_id)
            .order("chunk_index")
            .execute()
        )
        return response.data

    def list_for_items(self, *, user_id: str, item_ids: list[str]) -> list[dict]:
        if not item_ids:
            return []
        response = (
            self.client.table("memory_chunks")
            .select(self.public_select)
            .eq("user_id", user_id)
            .in_("memory_item_id", item_ids)
            .order("memory_item_id")
            .order("chunk_index")
            .execute()
        )
        return response.data

    def match(
        self,
        *,
        user_id: str,
        request: SearchRequest,
        query_embedding: list[float],
        expanded_terms: list[str],
        expanded_entities: list[str],
    ) -> list[dict]:
        response = self.client.rpc(
            "match_memory_chunks",
            {
                "query_embedding": self._vector_literal(query_embedding),
                "target_user_id": user_id,
                "expanded_terms": expanded_terms,
                "expanded_entities": expanded_entities,
                "match_count": request.limit,
                "match_threshold": 0.15,
                "filter_source_types": [source.value for source in request.source_types]
                if request.source_types
                else None,
                "filter_start_at": request.start_at,
                "filter_end_at": request.end_at,
            },
        ).execute()
        return response.data

    def related_candidates(
        self,
        *,
        user_id: str,
        chunk_id: str,
        expanded_terms: list[str],
        expanded_entities: list[str],
        limit: int = 5,
    ) -> list[dict]:
        response = self.client.rpc(
            "find_related_memory_candidates",
            {
                "anchor_chunk_id": chunk_id,
                "target_user_id": user_id,
                "expanded_terms": expanded_terms,
                "expanded_entities": expanded_entities,
                "match_count": limit,
            },
        ).execute()
        return response.data
    def _vector_literal(self, vector: list[float]) -> str:
        return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"

from supabase import Client

from app.core.config import Settings
from app.schemas.openai import NormalizedMemory, VisionExtraction


class MemoryExtractionsRepository:
    def __init__(self, client: Client):
        self.client = client

    def create(
        self,
        *,
        settings: Settings,
        user_id: str,
        memory_item_id: str,
        ingestion_job_id: str,
        extractor: str,
        extraction: VisionExtraction,
        normalized: NormalizedMemory,
        usage: dict | None = None,
    ) -> dict:
        payload = {
            "user_id": user_id,
            "memory_item_id": memory_item_id,
            "ingestion_job_id": ingestion_job_id,
            "pipeline_version": settings.pipeline_version,
            "extraction_version": settings.extraction_schema_version,
            "extraction_schema_version": settings.extraction_schema_version,
            "normalization_version": settings.prompt_version,
            "extractor": extractor,
            "model": settings.openai_vision_model,
            "prompt_version": settings.prompt_version,
            "visible_text": extraction.visible_text,
            "visual_summary": extraction.visual_summary,
            "normalized_text": normalized.retrieval_text,
            "structured": extraction.model_dump(mode="json"),
            "normalized": normalized.model_dump(mode="json"),
            "confidence": extraction.confidence,
            "usage": usage or {},
        }
        response = self.client.table("memory_extractions").insert(payload).execute()
        return response.data[0]


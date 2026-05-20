from datetime import UTC, datetime

from supabase import Client

from app.core.config import get_settings
from app.schemas.memory import IngestionJobStatus, IngestionStage


class IngestionJobsRepository:
    def __init__(self, client: Client):
        self.client = client
        self.settings = get_settings()

    def create_for_item(self, *, user_id: str, memory_item_id: str) -> dict:
        payload = {
            "user_id": user_id,
            "memory_item_id": memory_item_id,
            "status": IngestionJobStatus.queued.value,
            "stage": IngestionStage.queued.value,
            "pipeline_version": self.settings.pipeline_version,
            "prompt_version": self.settings.prompt_version,
            "chunker_version": self.settings.chunker_version,
            "embedding_version": self.settings.embedding_version,
            "extraction_schema_version": self.settings.extraction_schema_version,
            "embedding_model": self.settings.openai_embedding_model,
            "embedding_dimensions": self.settings.openai_embedding_dimensions,
            "vision_model": self.settings.openai_vision_model,
        }
        response = self.client.table("ingestion_jobs").insert(payload).execute()
        return response.data[0]

    def get(self, *, user_id: str, job_id: str) -> dict:
        response = (
            self.client.table("ingestion_jobs")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", job_id)
            .single()
            .execute()
        )
        return response.data

    def mark_running(self, *, user_id: str, job_id: str, stage: IngestionStage) -> None:
        self.client.table("ingestion_jobs").update(
            {
                "status": IngestionJobStatus.running.value,
                "stage": stage.value,
                "started_at": datetime.now(UTC).isoformat(),
            }
        ).eq("user_id", user_id).eq("id", job_id).execute()

    def update_stage(self, *, user_id: str, job_id: str, stage: IngestionStage) -> None:
        self.client.table("ingestion_jobs").update({"stage": stage.value}).eq("user_id", user_id).eq(
            "id", job_id
        ).execute()

    def mark_succeeded(self, *, user_id: str, job_id: str, usage: dict | None = None) -> None:
        self.client.table("ingestion_jobs").update(
            {
                "status": IngestionJobStatus.succeeded.value,
                "stage": IngestionStage.done.value,
                "finished_at": datetime.now(UTC).isoformat(),
                "usage": usage or {},
            }
        ).eq("user_id", user_id).eq("id", job_id).execute()

    def mark_failed(self, *, user_id: str, job_id: str, error_message: str) -> None:
        self.client.table("ingestion_jobs").update(
            {
                "status": IngestionJobStatus.failed.value,
                "stage": IngestionStage.failed.value,
                "finished_at": datetime.now(UTC).isoformat(),
                "error_message": error_message,
            }
        ).eq("user_id", user_id).eq("id", job_id).execute()

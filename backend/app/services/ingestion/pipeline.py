from app.core.config import Settings
from app.db.repositories.ingestion_jobs import IngestionJobsRepository
from app.db.repositories.memory_chunks import MemoryChunksRepository
from app.db.repositories.memory_extractions import MemoryExtractionsRepository
from app.db.repositories.memory_items import MemoryItemsRepository
from app.schemas.memory import InputModality, MemoryItemStatus, MemorySourceType, IngestionStage
from app.schemas.openai import VisionExtraction
from app.services.ingestion.chunker import MemoryChunker
from app.services.ingestion.normalizer import MemoryNormalizer
from app.services.ingestion.pdf import extract_pdf_text
from app.services.openai.embeddings import OpenAIEmbeddingService
from app.services.openai.vision import OpenAIVisionService
from app.services.storage.supabase_storage import SupabaseStorageService


class IngestionPipeline:
    def __init__(
        self,
        *,
        settings: Settings,
        items: MemoryItemsRepository,
        jobs: IngestionJobsRepository,
        extractions: MemoryExtractionsRepository,
        chunks: MemoryChunksRepository,
        storage: SupabaseStorageService,
        vision: OpenAIVisionService,
        normalizer: MemoryNormalizer,
        chunker: MemoryChunker,
        embeddings: OpenAIEmbeddingService,
    ):
        self.settings = settings
        self.items = items
        self.jobs = jobs
        self.extractions = extractions
        self.chunks = chunks
        self.storage = storage
        self.vision = vision
        self.normalizer = normalizer
        self.chunker = chunker
        self.embeddings = embeddings

    def run_job(self, user_id: str, item_id: str, job_id: str, locale: str = "ja") -> None:
        try:
            self.jobs.mark_running(user_id=user_id, job_id=job_id, stage=IngestionStage.extracting)
            self.items.update_status(user_id=user_id, item_id=item_id, status=MemoryItemStatus.processing)
            item = self.items.get(user_id=user_id, item_id=item_id)

            modality = InputModality(item["input_modality"])
            source_type = MemorySourceType(item["source_type"])
            raw_text = self._raw_text(item=item, modality=modality)
            extraction = self._extract(item=item, modality=modality, locale=locale)

            self.jobs.update_stage(user_id=user_id, job_id=job_id, stage=IngestionStage.normalizing)
            normalized = self.normalizer.normalize(
                source_type=source_type,
                input_modality=modality,
                raw_text=raw_text,
                extraction=extraction,
                source_label=item.get("source_label"),
                locale=locale,
            )

            extraction_row = self.extractions.create(
                settings=self.settings,
                user_id=user_id,
                memory_item_id=item_id,
                ingestion_job_id=job_id,
                extractor="openai_vision" if extraction else "direct_text",
                extraction=extraction or VisionExtraction(visible_text=raw_text or "", confidence=0.3),
                normalized=normalized,
            )

            self.jobs.update_stage(user_id=user_id, job_id=job_id, stage=IngestionStage.chunking)
            drafts = self.chunker.build_chunks(
                input_modality=modality,
                normalized=normalized,
                extraction=extraction,
                preview_storage_path=item.get("preview_storage_path") or item.get("storage_path"),
            )

            self.jobs.update_stage(user_id=user_id, job_id=job_id, stage=IngestionStage.embedding)
            embeddings = self.embeddings.embed_texts([draft.content for draft in drafts])
            self.chunks.create_many(
                settings=self.settings,
                user_id=user_id,
                memory_item_id=item_id,
                extraction_id=extraction_row["id"],
                chunks=drafts,
                embeddings=embeddings,
            )

            self.items.update_status(
                user_id=user_id,
                item_id=item_id,
                status=MemoryItemStatus.ready,
                title=normalized.title,
                source_label=normalized.source_label,
            )
            self.jobs.mark_succeeded(user_id=user_id, job_id=job_id)
        except Exception as exc:
            self.items.update_status(
                user_id=user_id,
                item_id=item_id,
                status=MemoryItemStatus.failed,
                error_message=str(exc),
            )
            self.jobs.mark_failed(user_id=user_id, job_id=job_id, error_message=str(exc))
            raise

    def _extract(self, *, item: dict, modality: InputModality, locale: str) -> VisionExtraction | None:
        if modality != InputModality.image:
            return None

        image_bytes = self.storage.download_memory_object(
            bucket=item["storage_bucket"],
            path=item["storage_path"],
        )
        return self.vision.extract_image_memory(
            image_bytes=image_bytes,
            filename=item.get("original_filename"),
            mime_type=item.get("mime_type"),
            locale=locale,
        )

    def _raw_text(self, *, item: dict, modality: InputModality) -> str | None:
        if item.get("raw_text"):
            return item["raw_text"]
        if not item.get("storage_bucket") or not item.get("storage_path"):
            return None

        if modality == InputModality.pdf:
            pdf_bytes = self.storage.download_memory_object(
                bucket=item["storage_bucket"],
                path=item["storage_path"],
            )
            return extract_pdf_text(pdf_bytes)

        if modality == InputModality.text:
            text_bytes = self.storage.download_memory_object(
                bucket=item["storage_bucket"],
                path=item["storage_path"],
            )
            return text_bytes.decode("utf-8", errors="replace")

        return None

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.db.repositories.ingestion_jobs import IngestionJobsRepository  # noqa: E402
from app.db.repositories.memory_chunks import MemoryChunksRepository  # noqa: E402
from app.db.repositories.memory_extractions import MemoryExtractionsRepository  # noqa: E402
from app.db.repositories.memory_items import MemoryItemsRepository  # noqa: E402
from app.db.supabase import get_supabase_client  # noqa: E402
from app.schemas.ingestion import IngestionTextRequest  # noqa: E402
from app.schemas.memory import InputModality, MemorySourceType  # noqa: E402
from app.schemas.search import SearchRequest  # noqa: E402
from app.services.ingestion.chunker import MemoryChunker  # noqa: E402
from app.services.ingestion.normalizer import MemoryNormalizer  # noqa: E402
from app.services.ingestion.pipeline import IngestionPipeline  # noqa: E402
from app.services.openai.embeddings import OpenAIEmbeddingService  # noqa: E402
from app.services.openai.query_expansion import OpenAIQueryExpansionService  # noqa: E402
from app.services.openai.vision import OpenAIVisionService  # noqa: E402
from app.services.retrieval.hybrid_search import HybridSearchService  # noqa: E402
from app.services.storage.supabase_storage import SupabaseStorageService  # noqa: E402
from scripts.seed_memory_dataset import screenshot_png  # noqa: E402


def require_env() -> None:
    missing = [
        name
        for name in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"]
        if not os.getenv(name)
    ]
    if missing:
        raise SystemExit("Missing required environment variables: " + ", ".join(missing))


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify screenshot ingestion through recall search.")
    parser.add_argument("--user-id", required=True, help="Existing Supabase auth user UUID.")
    parser.add_argument("--query", default="前のRouteSnap広告案")
    args = parser.parse_args()

    require_env()
    settings = get_settings()
    client = get_supabase_client(settings)
    storage = SupabaseStorageService(client, settings.supabase_storage_bucket)
    items = MemoryItemsRepository(client)
    jobs = IngestionJobsRepository(client)
    chunks = MemoryChunksRepository(client)

    pipeline = IngestionPipeline(
        settings=settings,
        items=items,
        jobs=jobs,
        extractions=MemoryExtractionsRepository(client),
        chunks=chunks,
        storage=storage,
        vision=OpenAIVisionService(settings),
        normalizer=MemoryNormalizer(settings),
        chunker=MemoryChunker(settings),
        embeddings=OpenAIEmbeddingService(settings),
    )
    search = HybridSearchService(
        query_expansion=OpenAIQueryExpansionService(settings),
        embeddings=OpenAIEmbeddingService(settings),
        chunks=chunks,
    )

    image = screenshot_png(
        [
            "RouteSnap delivery LP recall verification",
            "Hero: fewer missed deliveries",
            "CTA: Start free route audit",
            "Blue logistics dashboard screenshot",
        ],
        title="SnapBrain E2E",
    )
    storage_result = storage.upload_memory_object(
        user_id=args.user_id,
        filename="snapbrain-e2e-routesnap.png",
        content_type="image/png",
        data=image,
    )
    request = IngestionTextRequest(
        source_type=MemorySourceType.screenshot,
        input_modality=InputModality.image,
        captured_at=datetime.now(UTC).isoformat(),
        source_label="E2E RouteSnap screenshot",
        metadata={"e2e": True},
    )
    item = items.create(
        user_id=args.user_id,
        request=request,
        storage_result=storage_result,
        original_filename="snapbrain-e2e-routesnap.png",
        mime_type="image/png",
        byte_size=len(image),
    )
    job = jobs.create_for_item(user_id=args.user_id, memory_item_id=item["id"])
    pipeline.run_job(args.user_id, item["id"], job["id"])

    response = search.search(
        user_id=args.user_id,
        request=SearchRequest(query=args.query, limit=5, include_related=True, include_debug=True),
    )
    print(response.model_dump_json(indent=2))

    if not response.results:
        raise SystemExit("E2E failed: no recall results returned")
    if item["id"] not in {result.item_id for result in response.results}:
        raise SystemExit("E2E warning: uploaded item was not in top recall results")


if __name__ == "__main__":
    main()


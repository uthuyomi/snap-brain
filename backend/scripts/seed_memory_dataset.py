import argparse
import sys
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

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
from app.services.ingestion.chunker import MemoryChunker  # noqa: E402
from app.services.ingestion.normalizer import MemoryNormalizer  # noqa: E402
from app.services.ingestion.pipeline import IngestionPipeline  # noqa: E402
from app.services.openai.embeddings import OpenAIEmbeddingService  # noqa: E402
from app.services.openai.vision import OpenAIVisionService  # noqa: E402
from app.services.storage.supabase_storage import SupabaseStorageService  # noqa: E402


def screenshot_png(lines: list[str], *, title: str) -> bytes:
    image = Image.new("RGB", (1280, 760), color=(248, 250, 252))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.rectangle((0, 0, 1280, 76), fill=(20, 31, 44))
    draw.text((36, 28), title, fill=(255, 255, 255), font=font)
    y = 122
    for line in lines:
        draw.text((56, y), line, fill=(15, 23, 42), font=font)
        y += 44
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def pdf_note(lines: list[str]) -> bytes:
    buffer = BytesIO()
    doc = canvas.Canvas(buffer, pagesize=letter)
    _, height = letter
    y = height - 72
    doc.setFont("Helvetica", 12)
    for line in lines:
        doc.drawString(72, y, line)
        y -= 22
    doc.save()
    return buffer.getvalue()


def ingest_file(
    *,
    pipeline: IngestionPipeline,
    storage: SupabaseStorageService,
    items: MemoryItemsRepository,
    jobs: IngestionJobsRepository,
    user_id: str,
    filename: str,
    content_type: str,
    data: bytes,
    source_type: MemorySourceType,
    source_label: str,
    captured_at: datetime,
) -> None:
    storage_result = storage.upload_memory_object(
        user_id=user_id,
        filename=filename,
        content_type=content_type,
        data=data,
    )
    request = IngestionTextRequest(
        source_type=source_type,
        input_modality=InputModality.from_mime_type(content_type),
        captured_at=captured_at.isoformat(),
        source_label=source_label,
        metadata={"seed": True},
    )
    item = items.create(
        user_id=user_id,
        request=request,
        storage_result=storage_result,
        original_filename=filename,
        mime_type=content_type,
        byte_size=len(data),
    )
    job = jobs.create_for_item(user_id=user_id, memory_item_id=item["id"])
    pipeline.run_job(user_id, item["id"], job["id"])
    print(f"ingested {source_label}: item={item['id']}")


def ingest_text(
    *,
    pipeline: IngestionPipeline,
    items: MemoryItemsRepository,
    jobs: IngestionJobsRepository,
    user_id: str,
    text: str,
    source_label: str,
    captured_at: datetime,
) -> None:
    request = IngestionTextRequest(
        raw_text=text,
        source_type=MemorySourceType.note,
        input_modality=InputModality.text,
        captured_at=captured_at.isoformat(),
        source_label=source_label,
        metadata={"seed": True},
    )
    item = items.create(
        user_id=user_id,
        request=request,
        storage_result=None,
        original_filename=None,
        mime_type="text/plain",
        byte_size=len(text.encode("utf-8")),
    )
    job = jobs.create_for_item(user_id=user_id, memory_item_id=item["id"])
    pipeline.run_job(user_id, item["id"], job["id"])
    print(f"ingested {source_label}: item={item['id']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed SnapBrain MVP retrieval dataset.")
    parser.add_argument("--user-id", required=True, help="Existing Supabase auth user UUID.")
    args = parser.parse_args()

    settings = get_settings()
    client = get_supabase_client(settings)
    storage = SupabaseStorageService(client, settings.supabase_storage_bucket)
    items = MemoryItemsRepository(client)
    jobs = IngestionJobsRepository(client)
    pipeline = IngestionPipeline(
        settings=settings,
        items=items,
        jobs=jobs,
        extractions=MemoryExtractionsRepository(client),
        chunks=MemoryChunksRepository(client),
        storage=storage,
        vision=OpenAIVisionService(settings),
        normalizer=MemoryNormalizer(settings),
        chunker=MemoryChunker(settings),
        embeddings=OpenAIEmbeddingService(settings),
    )

    now = datetime.now(UTC)
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="routesnap-ad-screenshot.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="RouteSnap広告スクショ",
        captured_at=now - timedelta(days=2),
        data=screenshot_png(
            [
                "RouteSnap delivery LP campaign",
                "Hero: Route optimization for local delivery teams",
                "CTA: Start free route audit",
                "Ad angle: fewer missed deliveries, faster dispatch",
            ],
            title="RouteSnap Ads",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="routesnap-pricing-lp.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="RouteSnap pricing LP screenshot",
        captured_at=now - timedelta(days=4),
        data=screenshot_png(
            [
                "RouteSnap pricing page",
                "Starter plan for local courier teams",
                "Blue dashboard preview with delivery KPIs",
                "Compare dispatch time before and after optimization",
            ],
            title="RouteSnap Pricing",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="stripe-error-screenshot.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="Stripe error screenshot",
        captured_at=now - timedelta(days=1),
        data=screenshot_png(
            [
                "Stripe API error",
                "payment_intent requires payment_method",
                "Dashboard request failed with 402",
                "Check webhook retry and test mode key",
            ],
            title="Stripe Dashboard",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="chatgpt-screenshot.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="ChatGPT screenshot",
        captured_at=now - timedelta(days=6),
        data=screenshot_png(
            [
                "Prompt: improve recall UX for screenshot memory",
                "Answer: explain why each result matched",
                "Use thumbnails, OCR text, and nearby memories",
            ],
            title="ChatGPT",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="ui-inspiration-blue-dashboard.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="UI inspiration screenshot",
        captured_at=now - timedelta(days=9),
        data=screenshot_png(
            [
                "Blue analytics dashboard inspiration",
                "Soft cards, compact KPI row, map panel",
                "Good reference for logistics SaaS UI",
            ],
            title="UI Inspiration",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="technical-error-image.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="Technical error screenshot",
        captured_at=now - timedelta(days=7),
        data=screenshot_png(
            [
                "FastAPI 500 error",
                "Supabase RPC match_memory_chunks missing parameter target_user_id",
                "Check migration version and client RPC payload",
            ],
            title="Backend Error",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="random-memo-screenshot.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="Random memo screenshot",
        captured_at=now - timedelta(days=10),
        data=screenshot_png(
            [
                "Remember: try softer blue-gray palette",
                "Avoid AI chat feeling",
                "Make search feel like memory recall",
            ],
            title="Notes App",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="twitter-screenshot.png",
        content_type="image/png",
        source_type=MemorySourceType.screenshot,
        source_label="Twitter screenshot",
        captured_at=now - timedelta(days=5),
        data=screenshot_png(
            [
                "Thread idea: AI memory layer should rediscover context",
                "Not an AI persona, more like searchable recall",
                "Screenshots are underrated as product memory",
            ],
            title="Twitter / X",
        ),
    )
    ingest_file(
        pipeline=pipeline,
        storage=storage,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        filename="pdf-note.pdf",
        content_type="application/pdf",
        source_type=MemorySourceType.pdf,
        source_label="PDF note",
        captured_at=now - timedelta(days=3),
        data=pdf_note(
            [
                "SnapBrain MVP note",
                "Prioritize retrieval UX before reflection.",
                "Search should explain why a memory matched.",
                "Related memories should be dynamic, not stored as hard links.",
            ]
        ),
    )
    ingest_text(
        pipeline=pipeline,
        items=items,
        jobs=jobs,
        user_id=args.user_id,
        source_label="Plain text memo",
        captured_at=now,
        text="前のRouteSnap広告案は、配送LPで使うheroコピーとCTAの方向性。UIは青系、訴求は配達漏れ削減と dispatch 速度。",
    )


if __name__ == "__main__":
    main()

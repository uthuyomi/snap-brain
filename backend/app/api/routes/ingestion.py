from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile

from app.api.deps import get_current_user_id, get_pipeline, get_repositories, get_storage, resolve_locale
from app.db.repositories.ingestion_jobs import IngestionJobsRepository
from app.db.repositories.memory_items import MemoryItemsRepository
from app.schemas.ingestion import IngestionCreateResponse, IngestionTextRequest
from app.schemas.memory import InputModality, MemorySourceType
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.storage.supabase_storage import SupabaseStorageService

router = APIRouter()


@router.post("/items", response_model=IngestionCreateResponse)
async def create_ingestion_item(
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    locale: Annotated[str, Depends(resolve_locale)],
    file: Annotated[UploadFile | None, File()] = None,
    text: Annotated[str | None, Form()] = None,
    source_type: Annotated[MemorySourceType, Form()] = MemorySourceType.unknown,
    captured_at: Annotated[str | None, Form()] = None,
    source_label: Annotated[str | None, Form()] = None,
    repositories=Depends(get_repositories),
    storage: SupabaseStorageService = Depends(get_storage),
    pipeline: IngestionPipeline = Depends(get_pipeline),
) -> IngestionCreateResponse:
    items: MemoryItemsRepository = repositories["items"]
    jobs: IngestionJobsRepository = repositories["jobs"]

    storage_result = None
    raw_text = text
    mime_type = None
    original_filename = None
    byte_size = None
    modality = InputModality.text

    if file is not None:
        payload = await file.read()
        storage_result = storage.upload_memory_object(
            user_id=user_id,
            filename=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
            data=payload,
        )
        original_filename = file.filename
        mime_type = file.content_type
        byte_size = len(payload)
        modality = InputModality.from_mime_type(file.content_type)
        raw_text = None

    request = IngestionTextRequest(
        raw_text=raw_text,
        source_type=source_type,
        input_modality=modality,
        captured_at=captured_at,
        source_label=source_label,
    )

    item = items.create(
        user_id=user_id,
        request=request,
        storage_result=storage_result,
        original_filename=original_filename,
        mime_type=mime_type,
        byte_size=byte_size,
    )
    job = jobs.create_for_item(user_id=user_id, memory_item_id=item["id"])

    background_tasks.add_task(pipeline.run_job, user_id, item["id"], job["id"], locale)
    return IngestionCreateResponse(item_id=item["id"], job_id=job["id"], status=job["status"])


@router.get("/items/{item_id}")
def get_ingestion_item(
    item_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repositories=Depends(get_repositories),
):
    return repositories["items"].get(user_id=user_id, item_id=item_id)


@router.get("/jobs/{job_id}")
def get_ingestion_job(
    job_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repositories=Depends(get_repositories),
):
    return repositories["jobs"].get(user_id=user_id, job_id=job_id)

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings
from app.db.repositories.ingestion_jobs import IngestionJobsRepository
from app.db.repositories.memory_chunks import MemoryChunksRepository
from app.db.repositories.memory_extractions import MemoryExtractionsRepository
from app.db.repositories.memory_items import MemoryItemsRepository
from app.db.repositories.profiles import ProfilesRepository
from app.db.repositories.user_memory_patterns import UserMemoryPatternsRepository
from app.db.supabase import get_supabase_auth_client, get_supabase_client
from app.services.ingestion.chunker import MemoryChunker
from app.services.ingestion.normalizer import MemoryNormalizer
from app.services.ingestion.pipeline import IngestionPipeline
from app.services.openai.embeddings import OpenAIEmbeddingService
from app.services.openai.query_expansion import OpenAIQueryExpansionService
from app.services.openai.vision import OpenAIVisionService
from app.services.retrieval.hybrid_search import HybridSearchService
from app.services.storage.supabase_storage import SupabaseStorageService


def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            response = get_supabase_auth_client(settings).auth.get_user(token)
            user = response.user
            if user and user.id:
                return user.id
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Supabase access token.",
            ) from exc

    if settings.allow_dev_user_header and x_user_id:
        return x_user_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid Authorization Bearer token.",
    )


def resolve_locale(
    x_snapbrain_ai_locale: Annotated[str | None, Header()] = None,
    x_snapbrain_locale: Annotated[str | None, Header()] = None,
    accept_language: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    requested = (x_snapbrain_ai_locale or x_snapbrain_locale or "").lower()
    if requested in {"ja", "en"}:
        return requested
    if requested == "auto" or not requested:
        if accept_language and accept_language.lower().startswith("ja"):
            return "ja"
        if settings.output_language in {"ja", "en"}:
            return settings.output_language
    return "en"


def get_repositories(settings: Settings = Depends(get_settings)):
    client = get_supabase_client(settings)
    return {
        "items": MemoryItemsRepository(client),
        "jobs": IngestionJobsRepository(client),
        "extractions": MemoryExtractionsRepository(client),
        "chunks": MemoryChunksRepository(client),
        "profiles": ProfilesRepository(client),
        "patterns": UserMemoryPatternsRepository(client),
    }


def get_storage(settings: Settings = Depends(get_settings)) -> SupabaseStorageService:
    return SupabaseStorageService(get_supabase_client(settings), settings.supabase_storage_bucket)


def get_pipeline(settings: Settings = Depends(get_settings)) -> IngestionPipeline:
    client = get_supabase_client(settings)
    storage = SupabaseStorageService(client, settings.supabase_storage_bucket)
    return IngestionPipeline(
        settings=settings,
        items=MemoryItemsRepository(client),
        jobs=IngestionJobsRepository(client),
        extractions=MemoryExtractionsRepository(client),
        chunks=MemoryChunksRepository(client),
        storage=storage,
        vision=OpenAIVisionService(settings),
        normalizer=MemoryNormalizer(settings),
        chunker=MemoryChunker(settings),
        embeddings=OpenAIEmbeddingService(settings),
    )


def get_search_service(settings: Settings = Depends(get_settings)) -> HybridSearchService:
    client = get_supabase_client(settings)
    return HybridSearchService(
        query_expansion=OpenAIQueryExpansionService(settings),
        embeddings=OpenAIEmbeddingService(settings),
        chunks=MemoryChunksRepository(client),
    )

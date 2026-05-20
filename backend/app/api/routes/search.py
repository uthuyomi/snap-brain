from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.api.deps import get_current_user_id, get_repositories, get_search_service, get_storage, resolve_locale
from app.schemas.search import PlaygroundCase, PlaygroundRequest, PlaygroundResponse, SearchRequest, SearchResponse
from app.services.retrieval.hybrid_search import HybridSearchService
from app.services.storage.supabase_storage import SupabaseStorageService

router = APIRouter()


@router.post("", response_model=SearchResponse)
def search_memories(
    request: SearchRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    locale: Annotated[str, Depends(resolve_locale)],
    x_snapbrain_session_id: Annotated[str | None, Header()] = None,
    search_service: HybridSearchService = Depends(get_search_service),
    storage: SupabaseStorageService = Depends(get_storage),
    repositories=Depends(get_repositories),
) -> SearchResponse:
    response = search_service.search(user_id=user_id, request=request, locale=locale)
    attach_preview_urls(response, storage)
    repositories["items"].record_search_hits(
        user_id=user_id,
        item_ids=list(dict.fromkeys(result.item_id for result in response.results[:10])),
        query=request.query,
        session_id=x_snapbrain_session_id,
    )
    _refresh_pattern_if_stale(user_id=user_id, repositories=repositories)
    return response


@router.post("/playground", response_model=PlaygroundResponse)
def recall_playground(
    request: PlaygroundRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    locale: Annotated[str, Depends(resolve_locale)],
    search_service: HybridSearchService = Depends(get_search_service),
    storage: SupabaseStorageService = Depends(get_storage),
) -> PlaygroundResponse:
    default_queries = {
        "ja": ["前の配送LP", "Stripeエラー", "青いダッシュボード", "RouteSnap広告", "あのUIのやつ"],
        "en": ["previous delivery LP", "Stripe error", "blue dashboard", "RouteSnap ad", "that UI screenshot"],
    }
    queries = request.queries or default_queries[locale]
    cases = []
    for query in queries:
        response = search_service.search(
            user_id=user_id,
            request=SearchRequest(
                query=query,
                limit=request.limit,
                include_related=request.include_related,
                include_debug=True,
            ),
            locale=locale,
        )
        attach_preview_urls(response, storage)
        cases.append(PlaygroundCase(query=query, response=response))
    return PlaygroundResponse(cases=cases)


def attach_preview_urls(response: SearchResponse, storage: SupabaseStorageService) -> None:
    for result in response.results:
        if result.preview_path and result.source_type in {"screenshot", "photo"}:
            result.preview_url = storage.create_signed_url(bucket=storage.bucket, path=result.preview_path)


def _refresh_pattern_if_stale(*, user_id: str, repositories, max_age_hours: int = 6) -> None:
    pattern = repositories["items"].latest_pattern(user_id=user_id)
    if pattern:
        updated_at = pattern.get("updated_at") or pattern.get("created_at")
        if updated_at:
            try:
                parsed = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=UTC)
                if datetime.now(UTC) - parsed < timedelta(hours=max_age_hours):
                    return
            except ValueError:
                pass
    repositories["items"].refresh_pattern(user_id=user_id)

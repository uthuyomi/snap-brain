from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.api.deps import get_current_user_id, get_repositories, get_storage
from app.schemas.memory import MemoryItemStatus
from app.services.storage.supabase_storage import SupabaseStorageService

router = APIRouter()


class MemoryStateUpdate(BaseModel):
    is_favorite: bool | None = None
    is_pinned: bool | None = None
    archived: bool | None = None


@router.get("")
def list_memories(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repositories=Depends(get_repositories),
    storage: SupabaseStorageService = Depends(get_storage),
):
    _refresh_pattern_if_stale(user_id=user_id, repositories=repositories)
    items = repositories["items"].list_recent(user_id=user_id)
    items = [_with_signed_urls(item, storage) for item in items]
    chunks = repositories["chunks"].list_for_items(user_id=user_id, item_ids=[item["id"] for item in items])
    chunks_by_item: dict[str, list[dict]] = {}
    for chunk in chunks:
        chunks_by_item.setdefault(chunk["memory_item_id"], []).append(chunk)
    for item in items:
        item["chunks"] = _representative_chunks(chunks_by_item.get(item["id"], []))
    pattern = repositories["items"].latest_pattern(user_id=user_id)
    return {"items": items, "pattern": pattern}


@router.get("/{item_id}")
def get_memory(
    item_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
    x_snapbrain_session_id: Annotated[str | None, Header()] = None,
    x_snapbrain_previous_memory_id: Annotated[str | None, Header()] = None,
    x_snapbrain_search_query: Annotated[str | None, Header()] = None,
    x_snapbrain_open_source: Annotated[str | None, Header()] = None,
    repositories=Depends(get_repositories),
    storage: SupabaseStorageService = Depends(get_storage),
):
    item = repositories["items"].get(user_id=user_id, item_id=item_id)
    item = _with_signed_urls(item, storage)
    repositories["items"].record_open(
        user_id=user_id,
        item_id=item_id,
        session_id=x_snapbrain_session_id,
        previous_item_id=x_snapbrain_previous_memory_id,
    )
    if x_snapbrain_search_query:
        repositories["items"].record_action(
            user_id=user_id,
            item_id=item_id,
            action_type="search_open",
            query=x_snapbrain_search_query,
            session_id=x_snapbrain_session_id,
            previous_item_id=x_snapbrain_previous_memory_id,
        )
    elif x_snapbrain_open_source == "related":
        repositories["items"].record_action(
            user_id=user_id,
            item_id=item_id,
            action_type="related_open",
            session_id=x_snapbrain_session_id,
            previous_item_id=x_snapbrain_previous_memory_id,
        )
    chunks = repositories["chunks"].list_for_item(user_id=user_id, item_id=item_id)
    related = _related_memories(user_id=user_id, item=item, chunks=chunks, repositories=repositories, storage=storage)
    return {"item": item, "chunks": chunks, "related": related}


@router.patch("/{item_id}")
def update_memory_state(
    item_id: str,
    request: MemoryStateUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    x_snapbrain_session_id: Annotated[str | None, Header()] = None,
    x_snapbrain_previous_memory_id: Annotated[str | None, Header()] = None,
    repositories=Depends(get_repositories),
    storage: SupabaseStorageService = Depends(get_storage),
):
    status = None
    actions: list[str] = []
    if request.archived is not None:
        status = MemoryItemStatus.archived if request.archived else MemoryItemStatus.ready
        actions.append("archived" if request.archived else "restore")
    if request.is_favorite is not None:
        actions.append("favorite_added" if request.is_favorite else "favorite_removed")
    if request.is_pinned is not None:
        actions.append("pinned" if request.is_pinned else "unpinned")

    item = repositories["items"].update_user_state(
        user_id=user_id,
        item_id=item_id,
        is_favorite=request.is_favorite,
        is_pinned=request.is_pinned,
        status=status,
    )
    for action in actions:
        repositories["items"].record_action(
            user_id=user_id,
            item_id=item_id,
            action_type=action,
            session_id=x_snapbrain_session_id,
            previous_item_id=x_snapbrain_previous_memory_id,
        )
    if actions:
        _refresh_pattern_if_stale(user_id=user_id, repositories=repositories)
    return {"item": _with_signed_urls(item, storage)}


@router.delete("/{item_id}")
def archive_memory(
    item_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
    x_snapbrain_session_id: Annotated[str | None, Header()] = None,
    x_snapbrain_previous_memory_id: Annotated[str | None, Header()] = None,
    repositories=Depends(get_repositories),
):
    item = repositories["items"].update_status(
        user_id=user_id,
        item_id=item_id,
        status=MemoryItemStatus.archived,
    )
    repositories["items"].record_action(
        user_id=user_id,
        item_id=item_id,
        action_type="deleted",
        session_id=x_snapbrain_session_id,
        previous_item_id=x_snapbrain_previous_memory_id,
    )
    _refresh_pattern_if_stale(user_id=user_id, repositories=repositories)
    return {"item": item}


def _with_signed_urls(item: dict, storage: SupabaseStorageService) -> dict:
    preview_bucket = item.get("preview_storage_bucket") or item.get("storage_bucket")
    preview_path = item.get("preview_storage_path") or item.get("storage_path")
    storage_bucket = item.get("storage_bucket")
    storage_path = item.get("storage_path")

    enriched = dict(item)
    enriched["preview_url"] = storage.create_signed_url(bucket=preview_bucket, path=preview_path) if preview_path else None
    enriched["original_url"] = storage.create_signed_url(bucket=storage_bucket, path=storage_path) if storage_path else None
    return enriched


def _representative_chunks(chunks: list[dict]) -> list[dict]:
    priority = {"semantic_summary": 0, "visual_summary": 1, "ocr_text": 2}
    sorted_chunks = sorted(chunks, key=lambda chunk: (priority.get(chunk.get("chunk_type"), 9), chunk.get("chunk_index") or 0))
    return sorted_chunks[:3]


def _related_memories(
    *,
    user_id: str,
    item: dict,
    chunks: list[dict],
    repositories,
    storage: SupabaseStorageService,
) -> list[dict]:
    anchor = next((chunk for chunk in chunks if chunk.get("chunk_type") == "semantic_summary"), chunks[0] if chunks else None)
    if not anchor:
        return []
    candidates = repositories["chunks"].related_candidates(
        user_id=user_id,
        chunk_id=anchor["id"],
        expanded_terms=[],
        expanded_entities=[],
        limit=12,
    )
    related = []
    seen_item_ids = {item["id"]}
    for candidate in candidates:
        candidate_item_id = candidate["memory_item_id"]
        if candidate_item_id in seen_item_ids:
            continue
        seen_item_ids.add(candidate_item_id)
        related_item = repositories["items"].get(user_id=user_id, item_id=candidate_item_id)
        related_item = _with_signed_urls(related_item, storage)
        related_item["chunks"] = _representative_chunks(
            repositories["chunks"].list_for_item(user_id=user_id, item_id=candidate_item_id)
        )
        related_item["relation_reason"] = _relation_reason(item, related_item, candidate)
        related.append(related_item)
        if len(related) >= 5:
            break
    if related:
        repositories["items"].record_related_retrieval(
            user_id=user_id,
            item_ids=[entry["id"] for entry in related],
        )
    return related


def _relation_reason(item: dict, related_item: dict, candidate: dict) -> str:
    reason = candidate.get("relation_reason")
    if reason == "same recall path":
        return "同じ検索の流れで開かれています"
    if reason == "saved around the same time":
        return "同じ時期に保存されています"
    if reason == "shares memory tags":
        return "同じ話題の記憶です"
    if reason == "same visual source type":
        return "似た内容のスクリーンショットです"
    if item.get("source_type") == related_item.get("source_type"):
        return "同じ種類の記憶です"
    if candidate.get("similarity", 0) >= 0.75:
        return "内容が近い記憶です"
    return "一緒に見つかりやすい記憶です"


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

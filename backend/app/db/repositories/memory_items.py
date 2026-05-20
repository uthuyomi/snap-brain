from supabase import Client

from app.schemas.ingestion import IngestionTextRequest, StorageResult
from app.schemas.memory import MemoryItemStatus


class MemoryItemsRepository:
    def __init__(self, client: Client):
        self.client = client

    def create(
        self,
        *,
        user_id: str,
        request: IngestionTextRequest,
        storage_result: StorageResult | None,
        original_filename: str | None,
        mime_type: str | None,
        byte_size: int | None,
    ) -> dict:
        payload = {
            "user_id": user_id,
            "source_type": request.source_type.value,
            "input_modality": request.input_modality.value,
            "raw_text": request.raw_text,
            "captured_at": request.captured_at,
            "source_label": request.source_label,
            "original_filename": original_filename,
            "mime_type": mime_type,
            "byte_size": byte_size,
            "status": MemoryItemStatus.pending.value,
            "metadata": request.metadata,
        }

        if storage_result:
            payload.update(
                {
                    "storage_bucket": storage_result.bucket,
                    "storage_path": storage_result.path,
                    "preview_storage_bucket": storage_result.preview_bucket,
                    "preview_storage_path": storage_result.preview_path,
                    "checksum_sha256": storage_result.checksum_sha256,
                    "thumbnail_metadata": storage_result.thumbnail_metadata,
                }
            )

        response = self.client.table("memory_items").insert(payload).execute()
        return response.data[0]

    def get(self, *, user_id: str, item_id: str) -> dict:
        response = (
            self.client.table("memory_items")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", item_id)
            .single()
            .execute()
        )
        return response.data

    def list_recent(self, *, user_id: str, limit: int = 30) -> list[dict]:
        response = (
            self.client.table("memory_items")
            .select("*")
            .eq("user_id", user_id)
            .neq("status", "archived")
            .order("is_pinned", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data

    def list_by_ids(self, *, user_id: str, item_ids: list[str]) -> list[dict]:
        if not item_ids:
            return []
        response = (
            self.client.table("memory_items")
            .select("*")
            .eq("user_id", user_id)
            .in_("id", item_ids)
            .execute()
        )
        by_id = {row["id"]: row for row in response.data}
        return [by_id[item_id] for item_id in item_ids if item_id in by_id]

    def update_user_state(
        self,
        *,
        user_id: str,
        item_id: str,
        is_favorite: bool | None = None,
        is_pinned: bool | None = None,
        status: MemoryItemStatus | None = None,
    ) -> dict:
        payload = {}
        if is_favorite is not None:
            payload["is_favorite"] = is_favorite
        if is_pinned is not None:
            payload["is_pinned"] = is_pinned
        if status is not None:
            payload["status"] = status.value

        response = (
            self.client.table("memory_items")
            .update(payload)
            .eq("user_id", user_id)
            .eq("id", item_id)
            .execute()
        )
        return response.data[0]

    def record_open(
        self,
        *,
        user_id: str,
        item_id: str,
        session_id: str | None = None,
        previous_item_id: str | None = None,
    ) -> None:
        self.client.rpc(
            "record_memory_open",
            {
                "target_user_id": user_id,
                "target_item_id": item_id,
                "interaction_session_id": session_id,
                "previous_item_id": previous_item_id,
            },
        ).execute()

    def record_search_hits(
        self,
        *,
        user_id: str,
        item_ids: list[str],
        query: str,
        session_id: str | None = None,
    ) -> None:
        if item_ids:
            self.client.rpc(
                "record_memory_search_hits",
                {
                    "target_user_id": user_id,
                    "target_item_ids": item_ids,
                    "search_query": query,
                    "interaction_session_id": session_id,
                },
            ).execute()

    def record_related_retrieval(self, *, user_id: str, item_ids: list[str]) -> None:
        if item_ids:
            self.client.rpc(
                "record_memory_related_retrieval",
                {"target_user_id": user_id, "target_item_ids": item_ids},
            ).execute()

    def record_action(
        self,
        *,
        user_id: str,
        item_id: str,
        action_type: str,
        query: str | None = None,
        session_id: str | None = None,
        previous_item_id: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        self.client.rpc(
            "record_memory_action",
            {
                "target_user_id": user_id,
                "target_item_id": item_id,
                "action_type": action_type,
                "search_query": query,
                "interaction_session_id": session_id,
                "previous_item_id": previous_item_id,
                "action_metadata": metadata or {},
            },
        ).execute()

    def latest_pattern(self, *, user_id: str) -> dict | None:
        response = (
            self.client.table("user_memory_patterns")
            .select("*")
            .eq("user_id", user_id)
            .order("snapshot_date", desc=True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def refresh_pattern(self, *, user_id: str) -> dict:
        response = self.client.rpc("refresh_user_memory_patterns", {"target_user_id": user_id}).execute()
        return response.data

    def update_status(
        self,
        *,
        user_id: str,
        item_id: str,
        status: MemoryItemStatus,
        error_message: str | None = None,
        title: str | None = None,
        source_label: str | None = None,
    ) -> dict:
        payload = {"status": status.value, "error_message": error_message}
        if title is not None:
            payload["title"] = title
        if source_label is not None:
            payload["source_label"] = source_label

        response = (
            self.client.table("memory_items")
            .update(payload)
            .eq("user_id", user_id)
            .eq("id", item_id)
            .execute()
        )
        return response.data[0]

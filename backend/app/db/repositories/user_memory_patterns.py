from supabase import Client
from datetime import UTC, datetime, timedelta


class UserMemoryPatternsRepository:
    def __init__(self, client: Client):
        self.client = client

    def latest(self, *, user_id: str) -> dict | None:
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

    def refresh(self, *, user_id: str) -> dict:
        response = self.client.rpc("refresh_user_memory_patterns", {"target_user_id": user_id}).execute()
        return response.data

    def list_users_with_recent_activity(self, *, limit: int = 100) -> list[str]:
        since = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        response = (
            self.client.table("memory_interactions")
            .select("user_id")
            .gte("created_at", since)
            .limit(limit)
            .execute()
        )
        return list(dict.fromkeys(row["user_id"] for row in response.data))

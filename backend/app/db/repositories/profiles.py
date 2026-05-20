from supabase import Client


class ProfilesRepository:
    def __init__(self, client: Client):
        self.client = client

    def get(self, *, user_id: str) -> dict | None:
        response = (
            self.client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return response.data

    def upsert_default(self, *, user_id: str, display_name: str | None, locale: str) -> dict:
        payload = {
            "id": user_id,
            "display_name": display_name,
            "locale": locale,
            "preferred_ai_language": locale,
        }
        response = self.client.table("profiles").upsert(payload, on_conflict="id").execute()
        return response.data[0]

    def update_locale(
        self,
        *,
        user_id: str,
        locale: str,
        preferred_ai_language: str,
    ) -> dict:
        response = (
            self.client.table("profiles")
            .update({"locale": locale, "preferred_ai_language": preferred_ai_language})
            .eq("id", user_id)
            .execute()
        )
        return response.data[0]

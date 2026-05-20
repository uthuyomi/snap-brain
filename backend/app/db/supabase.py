from functools import lru_cache

from supabase import Client, create_client

from app.core.config import Settings


@lru_cache
def _cached_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return _cached_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_auth_client(settings: Settings) -> Client:
    key = settings.supabase_anon_key or settings.supabase_service_role_key
    if not settings.supabase_url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required")
    return _cached_client(settings.supabase_url, key)

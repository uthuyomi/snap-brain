from app.core.config import get_settings
from app.db.repositories.user_memory_patterns import UserMemoryPatternsRepository
from app.db.supabase import get_supabase_client


def run_lightweight_reflection_for_user(user_id: str) -> dict:
    """Refresh ranking-oriented recall patterns for one user.

    This is not persona reflection. It is a compact aggregation used for recall ranking,
    suggestions, and frequently recalled sections.
    """
    settings = get_settings()
    repository = UserMemoryPatternsRepository(get_supabase_client(settings))
    return repository.refresh(user_id=user_id)


def run_daily_reflection_job(limit: int = 100) -> list[dict]:
    settings = get_settings()
    repository = UserMemoryPatternsRepository(get_supabase_client(settings))
    snapshots = []
    for user_id in repository.list_users_with_recent_activity(limit=limit):
        snapshots.append(repository.refresh(user_id=user_id))
    return snapshots


def run_reflection_stub() -> None:
    run_daily_reflection_job(limit=100)

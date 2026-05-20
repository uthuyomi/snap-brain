from openai import OpenAI

from app.core.config import Settings


def create_openai_client(settings: Settings) -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required")
    return OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_request_timeout_seconds)


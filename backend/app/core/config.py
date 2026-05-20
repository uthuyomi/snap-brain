from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "SnapBrain API"
    frontend_origin: str = Field(default="http://127.0.0.1:3001", alias="FRONTEND_ORIGIN")
    frontend_origins: str = Field(default="", alias="FRONTEND_ORIGINS")

    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_storage_bucket: str = Field(default="memory-objects", alias="SUPABASE_STORAGE_BUCKET")
    allow_dev_user_header: bool = Field(default=False, alias="ALLOW_DEV_USER_HEADER")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_vision_model: str = Field(default="gpt-5.2", alias="OPENAI_VISION_MODEL")
    openai_query_model: str = Field(default="gpt-5.2", alias="OPENAI_QUERY_MODEL")
    openai_embedding_model: str = Field(
        default="text-embedding-3-large",
        alias="OPENAI_EMBEDDING_MODEL",
    )
    openai_embedding_dimensions: int = Field(default=1536, alias="OPENAI_EMBEDDING_DIMENSIONS")
    openai_request_timeout_seconds: float = Field(default=60, alias="OPENAI_REQUEST_TIMEOUT_SECONDS")
    output_language: str = Field(default="ja", alias="OUTPUT_LANGUAGE")

    pipeline_version: str = "ingestion-v1"
    prompt_version: str = "prompt-v1"
    extraction_schema_version: str = "memory-extraction-v1"
    chunker_version: str = "chunker-v1"
    embedding_version: str = "embedding-v1"

    def allowed_frontend_origins(self) -> list[str]:
        configured = [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]
        defaults = [
            self.frontend_origin,
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://localhost:3000",
            "http://localhost:3001",
        ]
        return list(dict.fromkeys([*configured, *defaults]))


@lru_cache
def get_settings() -> Settings:
    return Settings()

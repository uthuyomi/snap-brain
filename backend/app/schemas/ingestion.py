from pydantic import BaseModel, ConfigDict, Field

from app.schemas.memory import InputModality, MemorySourceType


class IngestionTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    raw_text: str | None = None
    source_type: MemorySourceType = MemorySourceType.unknown
    input_modality: InputModality = InputModality.text
    captured_at: str | None = None
    source_label: str | None = None
    metadata: dict = Field(default_factory=dict)


class StorageResult(BaseModel):
    bucket: str
    path: str
    preview_bucket: str | None = None
    preview_path: str | None = None
    checksum_sha256: str | None = None
    thumbnail_metadata: dict = Field(default_factory=dict)


class IngestionCreateResponse(BaseModel):
    item_id: str
    job_id: str
    status: str


class IngestionJobResult(BaseModel):
    item_id: str
    job_id: str
    status: str
    chunks_created: int = 0

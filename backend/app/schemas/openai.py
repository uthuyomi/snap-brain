from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.memory import MemoryChunkType


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExtractedEntity(StrictBaseModel):
    type: Literal[
        "person",
        "organization",
        "place",
        "product",
        "app",
        "project",
        "date",
        "identifier",
        "tag",
        "unknown",
    ] = "unknown"
    name: str
    confidence: float = Field(ge=0, le=1, default=0.5)


class ImageRegion(StrictBaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class VisionExtraction(StrictBaseModel):
    visible_text: str = ""
    visual_summary: str = ""
    likely_context: str = ""
    entities: list[ExtractedEntity] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    time_hints: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, default=0.5)


class NormalizedMemory(StrictBaseModel):
    title: str | None = None
    source_label: str
    normalized_summary: str
    retrieval_text: str
    why_this_may_matter: str | None = None
    tags: list[str] = Field(default_factory=list)
    thumbnail_metadata: dict = Field(default_factory=dict)
    importance_score: float = Field(ge=0, le=1, default=0.0)

    @field_validator("retrieval_text")
    @classmethod
    def retrieval_text_required(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("retrieval_text must not be empty")
        return value


class MemoryChunkDraft(StrictBaseModel):
    chunk_index: int = Field(ge=0)
    chunk_type: MemoryChunkType
    content: str
    source_start: int | None = None
    source_end: int | None = None
    page_number: int | None = None
    image_region: ImageRegion | None = None
    importance_score: float = Field(ge=0, le=1, default=0.0)
    source_label: str | None = None
    preview_storage_path: str | None = None
    thumbnail_metadata: dict = Field(default_factory=dict)
    retrieval_metadata: dict = Field(default_factory=dict)

    @field_validator("content")
    @classmethod
    def content_required(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("chunk content must not be empty")
        return value


class EmbeddingResult(StrictBaseModel):
    model: str
    dimensions: int
    embedding_version: str
    vector: list[float]
    embedding_hash: str
    usage: dict = Field(default_factory=dict)


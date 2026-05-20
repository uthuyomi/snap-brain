from enum import StrEnum


class MemorySourceType(StrEnum):
    screenshot = "screenshot"
    photo = "photo"
    pdf = "pdf"
    note = "note"
    file = "file"
    web = "web"
    unknown = "unknown"


class InputModality(StrEnum):
    image = "image"
    pdf = "pdf"
    text = "text"
    mixed = "mixed"

    @classmethod
    def from_mime_type(cls, mime_type: str | None) -> "InputModality":
        if not mime_type:
            return cls.mixed
        if mime_type.startswith("image/"):
            return cls.image
        if mime_type == "application/pdf":
            return cls.pdf
        if mime_type.startswith("text/"):
            return cls.text
        return cls.mixed


class MemoryItemStatus(StrEnum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"
    archived = "archived"


class IngestionJobStatus(StrEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class IngestionStage(StrEnum):
    queued = "queued"
    detecting = "detecting"
    extracting = "extracting"
    normalizing = "normalizing"
    chunking = "chunking"
    embedding = "embedding"
    organizing = "organizing"
    done = "done"
    failed = "failed"


class MemoryChunkType(StrEnum):
    ocr_text = "ocr_text"
    visual_summary = "visual_summary"
    semantic_summary = "semantic_summary"
    entity_context = "entity_context"
    page_section = "page_section"
    note = "note"


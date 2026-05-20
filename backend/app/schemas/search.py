from pydantic import BaseModel, ConfigDict, Field

from app.schemas.memory import MemoryChunkType, MemorySourceType


class SearchRequest(BaseModel):
    query: str
    source_types: list[MemorySourceType] | None = None
    start_at: str | None = None
    end_at: str | None = None
    limit: int = Field(default=10, ge=1, le=50)
    include_related: bool = True
    use_query_expansion: bool = True
    include_debug: bool = False


class QueryExpansion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original_query: str
    expanded_query: str
    terms: list[str] = Field(default_factory=list)
    entities: list[str] = Field(default_factory=list)
    intent_summary: str


class RelatedMemoryCandidate(BaseModel):
    chunk_id: str
    item_id: str
    source_label: str | None = None
    source_type: MemorySourceType | None = None
    preview_path: str | None = None
    similarity: float
    relation_reason: str | None = None
    content_preview: str | None = None


class SearchResult(BaseModel):
    chunk_id: str
    item_id: str
    score: float
    source_type: MemorySourceType
    chunk_type: MemoryChunkType
    source_label: str | None = None
    content: str
    short_summary: str | None = None
    captured_at: str | None = None
    preview_path: str | None = None
    preview_url: str | None = None
    thumbnail: dict = Field(default_factory=dict)
    why_matched: str | None = None
    personal_context: list[str] = Field(default_factory=list)
    related: list[RelatedMemoryCandidate] = Field(default_factory=list)
    ranking_signals: dict = Field(default_factory=dict)
    debug: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    expanded_query: str | None = None
    expanded_terms: list[str] = Field(default_factory=list)
    expanded_entities: list[str] = Field(default_factory=list)
    recall_summary: str | None = None
    results: list[SearchResult]


class PlaygroundRequest(BaseModel):
    queries: list[str] = Field(default_factory=list, max_length=20)
    limit: int = Field(default=8, ge=1, le=20)
    include_related: bool = True


class PlaygroundCase(BaseModel):
    query: str
    response: SearchResponse


class PlaygroundResponse(BaseModel):
    cases: list[PlaygroundCase]

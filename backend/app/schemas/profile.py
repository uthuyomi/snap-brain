from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    id: str
    display_name: str | None = None
    locale: str = "auto"
    preferred_ai_language: str = "auto"
    resolved_locale: str = "en"


class ProfileUpdateRequest(BaseModel):
    locale: str = Field(pattern="^(auto|ja|en)$")
    preferred_ai_language: str = Field(pattern="^(auto|ja|en)$")


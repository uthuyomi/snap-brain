from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id, get_repositories, resolve_locale
from app.schemas.profile import ProfileResponse, ProfileUpdateRequest

router = APIRouter()


@router.get("", response_model=ProfileResponse)
def get_profile(
    user_id: Annotated[str, Depends(get_current_user_id)],
    locale: Annotated[str, Depends(resolve_locale)],
    repositories=Depends(get_repositories),
) -> ProfileResponse:
    profile = repositories["profiles"].get(user_id=user_id)
    if not profile:
        profile = repositories["profiles"].upsert_default(user_id=user_id, display_name=None, locale=locale)
    resolved = resolve_profile_locale(profile.get("locale", "auto"), locale)
    return ProfileResponse(
        id=profile["id"],
        display_name=profile.get("display_name"),
        locale=profile.get("locale", "auto"),
        preferred_ai_language=profile.get("preferred_ai_language", "auto"),
        resolved_locale=resolved,
    )


@router.patch("", response_model=ProfileResponse)
def update_profile(
    request: ProfileUpdateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    locale: Annotated[str, Depends(resolve_locale)],
    repositories=Depends(get_repositories),
) -> ProfileResponse:
    profile = repositories["profiles"].update_locale(
        user_id=user_id,
        locale=request.locale,
        preferred_ai_language=request.preferred_ai_language,
    )
    resolved = resolve_profile_locale(profile.get("locale", "auto"), locale)
    return ProfileResponse(
        id=profile["id"],
        display_name=profile.get("display_name"),
        locale=profile.get("locale", "auto"),
        preferred_ai_language=profile.get("preferred_ai_language", "auto"),
        resolved_locale=resolved,
    )


def resolve_profile_locale(profile_locale: str, fallback: str) -> str:
    if profile_locale in {"ja", "en"}:
        return profile_locale
    return fallback if fallback in {"ja", "en"} else "en"

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id, get_repositories

router = APIRouter()


@router.post("/refresh")
def refresh_personal_recall_patterns(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repositories=Depends(get_repositories),
):
    pattern = repositories["patterns"].refresh(user_id=user_id)
    return {"pattern": pattern}

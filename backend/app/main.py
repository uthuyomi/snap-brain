from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, ingestion, memories, profile, reflection, search
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_frontend_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
    app.include_router(search.router, prefix="/api/search", tags=["search"])
    app.include_router(memories.router, prefix="/api/memories", tags=["memories"])
    app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
    app.include_router(reflection.router, prefix="/api/reflection", tags=["reflection"])
    return app


app = create_app()

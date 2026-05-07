from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.galaxy import router as galaxy_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.ml import router as ml_router
from app.api.routes.session import router as session_router
from app.core.logging import configure_logging
from app.core.settings import get_settings

configure_logging()
settings = get_settings()

app = FastAPI(
    title="Melody Map Next-Gen API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID", "X-CSRF-Token"],
)

app.include_router(health_router, prefix="/api")
app.include_router(session_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(ml_router, prefix="/api")
app.include_router(galaxy_router, prefix="/api")

from fastapi import APIRouter, Request

from app.core.contracts import ApiEnvelope, ResponseMeta
from app.models.galaxy import GalaxyArtifactPayload, GalaxyJobRequest
from app.models.jobs import JobStatusPayload
from app.services.galaxy_jobs import enqueue_galaxy_job
from app.services.galaxy_pipeline import build_galaxy_artifact

router = APIRouter(prefix="/galaxy", tags=["galaxy"])


@router.post("/build", response_model=ApiEnvelope[GalaxyArtifactPayload])
async def build_galaxy(profile: GalaxyJobRequest, request: Request) -> ApiEnvelope[GalaxyArtifactPayload]:
    artifact = build_galaxy_artifact(profile.profile)
    return ApiEnvelope(
        ok=True,
        data=artifact,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", profile.idempotency_key),
            cache="miss",
            warnings=[],
        ),
    )


@router.post("/jobs", response_model=ApiEnvelope[JobStatusPayload])
async def enqueue_galaxy(profile: GalaxyJobRequest, request: Request) -> ApiEnvelope[JobStatusPayload]:
    status = enqueue_galaxy_job(profile)
    return ApiEnvelope(
        ok=True,
        data=status,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", profile.idempotency_key),
            cache="miss",
        ),
    )

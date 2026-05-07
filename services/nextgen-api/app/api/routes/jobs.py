from fastapi import APIRouter, Request

from app.core.contracts import ApiEnvelope, ResponseMeta
from app.models.jobs import JobRequest, JobStatusPayload
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=ApiEnvelope[JobStatusPayload])
async def create_job(job: JobRequest, request: Request) -> ApiEnvelope[JobStatusPayload]:
    status = enqueue_job(job)
    return ApiEnvelope(
        ok=True,
        data=status,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", job.idempotency_key),
            cache="miss",
        ),
    )

from __future__ import annotations

import uuid

from celery import Celery

from app.models.galaxy import GalaxyJobRequest
from app.models.jobs import JobStatusPayload


celery_client = Celery(
    "melody_map_nextgen_api",
    broker="redis://redis:6379/1",
    backend="redis://redis:6379/2",
)


def enqueue_galaxy_job(request: GalaxyJobRequest) -> JobStatusPayload:
    try:
        async_result = celery_client.send_task(
            "galaxy.layout.generate",
            kwargs={"profile": request.profile.model_dump()},
            task_id=f"galaxy-{request.idempotency_key}",
        )
        job_id = async_result.id
    except Exception:
        job_id = f"galaxy-local-{uuid.uuid4().hex[:10]}"

    return JobStatusPayload(
        job_id=job_id,
        job_type="galaxy_layout",
        state="queued",
        progress=0.0,
        warnings=[],
    )

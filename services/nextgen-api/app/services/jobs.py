from __future__ import annotations

import uuid

from app.models.jobs import JobRequest, JobStatusPayload


def enqueue_job(request: JobRequest) -> JobStatusPayload:
    return JobStatusPayload(
        job_id=f"job_{uuid.uuid4().hex[:12]}",
        job_type=request.job_type,
        state="queued",
        progress=0.0,
        warnings=[],
    )

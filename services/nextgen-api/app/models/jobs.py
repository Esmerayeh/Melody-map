from typing import Literal

from pydantic import BaseModel, Field


JobType = Literal[
    "profile_recompute",
    "similarity_refresh",
    "soulmate_match",
    "galaxy_layout",
    "aesthetic_generation",
]

JobState = Literal["queued", "running", "completed", "failed", "retrying"]


class JobRequest(BaseModel):
    job_type: JobType
    user_id: str
    idempotency_key: str
    force_refresh: bool = False
    source_window: str = "medium_term"


class JobStatusPayload(BaseModel):
    job_id: str
    job_type: JobType
    state: JobState
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    artifact_key: str | None = None
    warnings: list[str] = Field(default_factory=list)

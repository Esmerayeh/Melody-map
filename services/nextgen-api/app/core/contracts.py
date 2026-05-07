from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ResponseMeta(BaseModel):
    request_id: str
    schema_version: str = "v1"
    generated_at: str = Field(default_factory=utc_now_iso)
    cache: str = "miss"
    degraded: bool = False
    warnings: list[str] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    retryable: bool = False


class ApiEnvelope(BaseModel, Generic[T]):
    ok: bool
    data: T | None = None
    meta: ResponseMeta
    error: ErrorEnvelope | None = None

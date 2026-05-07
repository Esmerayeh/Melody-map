from fastapi import APIRouter, Request

from app.core.contracts import ApiEnvelope, ResponseMeta

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiEnvelope[dict])
async def health_check(request: Request) -> ApiEnvelope[dict]:
    return ApiEnvelope(
        ok=True,
        data={"status": "ok", "service": "nextgen-api"},
        meta=ResponseMeta(request_id=request.headers.get("x-request-id", "local-health")),
    )

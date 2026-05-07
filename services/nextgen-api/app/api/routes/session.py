from fastapi import APIRouter, Request

from app.core.contracts import ApiEnvelope, ResponseMeta
from app.models.bootstrap import SessionBootstrapPayload
from app.services.session_bootstrap import build_session_bootstrap

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/bootstrap", response_model=ApiEnvelope[SessionBootstrapPayload])
async def session_bootstrap(request: Request) -> ApiEnvelope[SessionBootstrapPayload]:
    payload = build_session_bootstrap(request)
    return ApiEnvelope(
        ok=True,
        data=payload,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", "bootstrap-local"),
            degraded=payload.profile_status.degraded,
            cache="miss",
        ),
    )

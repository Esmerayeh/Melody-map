from fastapi import APIRouter, Request

from app.core.contracts import ApiEnvelope, ResponseMeta
from app.models.ml import SimilarityNeighborhood
from app.services.ml_pipeline import build_profile_artifact, build_similarity_neighborhood

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/profile-artifact/{user_id}", response_model=ApiEnvelope[dict])
async def profile_artifact(user_id: str, request: Request, source_window: str = "medium_term") -> ApiEnvelope[dict]:
    payload = build_profile_artifact(user_id, source_window, ["spotify"])
    return ApiEnvelope(
        ok=True,
        data=payload,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", f"profile-{user_id}"),
            cache="stale",
            warnings=payload.get("warnings", []),
        ),
    )


@router.get("/similarity/{subject_id}", response_model=ApiEnvelope[SimilarityNeighborhood])
async def similarity_neighborhood(subject_id: str, request: Request) -> ApiEnvelope[SimilarityNeighborhood]:
    payload = build_similarity_neighborhood(subject_id, ["artist-a", "artist-b", "artist-c"])
    return ApiEnvelope(
        ok=True,
        data=payload,
        meta=ResponseMeta(
            request_id=request.headers.get("x-request-id", f"sim-{subject_id}"),
            cache="miss",
        ),
    )

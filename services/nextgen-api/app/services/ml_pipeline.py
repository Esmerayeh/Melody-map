from __future__ import annotations

import hashlib

from app.models.ml import SimilarityNeighborhood
from app.services.feature_store import build_feature_artifact


def deterministic_artifact_id(user_id: str, source_window: str, provider_mix: list[str]) -> str:
    digest = hashlib.sha256(f"{user_id}:{source_window}:{','.join(sorted(provider_mix))}".encode("utf-8")).hexdigest()
    return digest[:24]


def build_profile_artifact(user_id: str, source_window: str, provider_mix: list[str]) -> dict:
    artifact_id = deterministic_artifact_id(user_id, source_window, provider_mix)
    artifact = build_feature_artifact(
        artifact_id=artifact_id,
        user_id=user_id,
        source_window=source_window,
        provider_mix=provider_mix,
        confidence=0.74,
        completeness=0.68,
        warnings=["profile artifact scaffolded by next-gen pipeline"],
    )
    return artifact.model_dump()


def build_similarity_neighborhood(subject_id: str, neighbor_ids: list[str]) -> SimilarityNeighborhood:
    ordered = sorted(set(neighbor_ids))
    return SimilarityNeighborhood(
        subject_id=subject_id,
        neighbors=ordered,
        confidence=0.71 if ordered else 0.22,
    )

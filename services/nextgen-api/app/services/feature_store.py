from __future__ import annotations

from datetime import datetime, timezone

from app.core.settings import get_settings
from app.models.ml import FeatureArtifact, PipelineVersionSet


def build_feature_artifact(
    *,
    artifact_id: str,
    user_id: str,
    source_window: str,
    provider_mix: list[str],
    confidence: float,
    completeness: float,
    warnings: list[str] | None = None,
) -> FeatureArtifact:
    settings = get_settings()
    return FeatureArtifact(
        artifact_id=artifact_id,
        user_id=user_id,
        source_window=source_window,
        provider_mix=provider_mix,
        confidence=confidence,
        completeness=completeness,
        generated_at=datetime.now(timezone.utc).isoformat(),
        versions=PipelineVersionSet(
            pipeline_version=settings.pipeline_version,
            embedding_version=settings.embedding_version,
            feature_schema_version=settings.feature_schema_version,
        ),
        warnings=warnings or [],
    )

from pydantic import BaseModel, Field


class PipelineVersionSet(BaseModel):
    pipeline_version: str
    embedding_version: str
    feature_schema_version: str


class FeatureArtifact(BaseModel):
    artifact_id: str
    user_id: str
    source_window: str
    provider_mix: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    completeness: float = Field(default=0.0, ge=0.0, le=1.0)
    generated_at: str
    versions: PipelineVersionSet
    warnings: list[str] = Field(default_factory=list)


class SimilarityNeighborhood(BaseModel):
    subject_id: str
    neighbors: list[str] = Field(default_factory=list)
    metric: str = "cosine"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)

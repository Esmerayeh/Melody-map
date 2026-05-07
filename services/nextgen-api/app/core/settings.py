from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "melody-map-nextgen-api"
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    redis_url: str = "redis://redis:6379/0"
    postgres_dsn: str = "postgresql://melody:melody@postgres:5432/melody_map"
    mongo_url: str = "mongodb://mongo:27017/melody_map"
    sentry_dsn: str | None = None
    tracing_sample_rate: float = Field(default=0.1, ge=0.0, le=1.0)
    auth_cookie_name: str = "mm_session"
    csrf_cookie_name: str = "mm_csrf"
    bootstrap_ttl_seconds: int = 30
    profile_cache_ttl_seconds: int = 300
    pipeline_version: str = "2026.04"
    embedding_version: str = "embeddings-v1"
    feature_schema_version: str = "feature-schema-v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

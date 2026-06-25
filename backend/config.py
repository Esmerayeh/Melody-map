"""Centralized environment-aware configuration for Melody Map backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None) -> str | None:
    value = os.getenv(key)
    return value if value not in (None, "") else default


def _env_int(key: str, default: int) -> int:
    raw = _env(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _env_bool(key: str, default: bool = False) -> bool:
    raw = _env(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_mongo_uri() -> str:
    direct_uri = _env("MONGO_URI")
    if direct_uri:
        return direct_uri

    direct_uri = _env("MONGODB_URI")
    if direct_uri:
        return direct_uri

    username = _env("MONGO_USERNAME")
    password = _env("MONGO_PASSWORD")
    cluster = _env("MONGO_CLUSTER_URL")
    database = _env("MONGO_DB_NAME", "melody_map")
    params = _env("MONGO_OPTIONS", "retryWrites=true&w=majority")

    if username and password and cluster:
        return (
            "mongodb+srv://"
            f"{quote_plus(username)}:{quote_plus(password)}@{cluster}/"
            f"{database}?{params}"
        )

    return f"mongodb://localhost:27017/{database}"


@dataclass(frozen=True)
class AppConfig:
    environment: str
    debug: bool
    testing: bool
    port: int
    mongodb_uri: str
    frontend_url: str
    secret_key: str
    spotify_client_id: str | None
    spotify_client_secret: str | None
    spotify_redirect_uri: str
    spotify_public_redirect_uri: str
    cookie_samesite: str
    cookie_secure: bool
    lastfm_api_key: str | None
    lastfm_api_secret: str | None
    lastfm_redirect_uri: str
    audio_features_provider: str
    unsplash_access_key: str | None
    pinterest_access_token: str | None
    redis_url: str | None
    mlflow_tracking_uri: str | None
    feature_store_mode: str
    retrieval_model_version: str
    ranking_model_version: str
    soulmate_model_version: str
    enable_shadow_retrieval: bool
    enable_shadow_ranker: bool
    enable_learned_soulmate: bool
    recommendation_canary_percent: int
    auralith_llm_provider: str
    auralith_llm_endpoint: str | None
    auralith_llm_api_key: str | None
    auralith_llm_model: str | None
    auralith_llm_timeout: int
    auralith_llm_max_tokens: int
    kafka_bootstrap_servers: str | None
    kafka_events_topic: str
    kafka_recommendation_feedback_topic: str
    kafka_recommendation_request_topic: str
    kafka_dlq_topic: str

    @property
    def spotify_credentials_available(self) -> bool:
        return bool(self.spotify_client_id and self.spotify_client_secret)

    @property
    def using_dev_secret(self) -> bool:
        return self.secret_key == "dev-secret-key"

    def public_runtime_summary(self) -> dict:
        return {
            "environment": self.environment,
            "debug": self.debug,
            "testing": self.testing,
            "frontendUrl": self.frontend_url,
            "spotifyConfigured": self.spotify_credentials_available,
            "usingDevSecret": self.using_dev_secret,
            "cookieSameSite": self.cookie_samesite,
            "cookieSecure": self.cookie_secure,
        }


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    environment = (_env("FLASK_ENV", "production") or "production").lower()
    testing = _env_bool("TESTING", False) or environment == "testing"
    debug = _env_bool("FLASK_DEBUG", False) or environment == "development"
    frontend_url = _env("FRONTEND_URL")
    if not frontend_url:
        frontend_url = "http://localhost:3000" if debug or testing else "https://melodymap.site"

    # ── Cookie policy (cross-site aware) ──────────────────────────────────────
    # In production the frontend (Vercel) and backend (Render) live on different
    # registrable domains, so the post-OAuth `/exchange` + `/bootstrap` calls are
    # cross-site XHR. Browsers only send/store cookies on cross-site XHR when they
    # are `SameSite=None; Secure`. With `SameSite=Lax` the session cookie never
    # reaches the backend on the next request and the user is bounced to /login.
    # Locally the Vite proxy makes everything same-origin, so `Lax` is correct
    # there (and avoids requiring HTTPS over plain-http loopback).
    frontend_is_local = ("localhost" in frontend_url) or ("127.0.0.1" in frontend_url)
    default_samesite = "Lax" if (frontend_is_local or testing) else "None"
    cookie_samesite = (_env("COOKIE_SAMESITE", default_samesite) or default_samesite).strip()
    # SameSite=None is only honored alongside Secure. Local plain-http stays
    # non-secure so cookies are accepted over http://127.0.0.1.
    if cookie_samesite.lower() == "none":
        default_secure = True
    else:
        default_secure = not (frontend_is_local or testing)
    cookie_secure = _env_bool("COOKIE_SECURE", default_secure)

    # ── Fail-fast on the public dev signing key in real production ─────────────
    # SECRET_KEY signs the auth JWTs. If it silently falls back to the well-known
    # "dev-secret-key" on a live deployment, anyone can forge a valid token and
    # bypass auth. Refuse to boot in that case. Local/testing/debug runs (and the
    # Vite-proxied 127.0.0.1 workflow) are intentionally exempt so onboarding and
    # `start-local.ps1` keep working with no extra ceremony.
    secret_key = _env("SECRET_KEY", "dev-secret-key") or "dev-secret-key"
    is_real_production = environment == "production" and not (debug or testing or frontend_is_local)
    if secret_key == "dev-secret-key" and is_real_production:
        raise RuntimeError(
            "SECRET_KEY is unset in production. Refusing to start with the public "
            "'dev-secret-key' - it signs auth JWTs and would let anyone forge a "
            "session. Set a strong, random SECRET_KEY environment variable."
        )

    return AppConfig(
        environment=environment,
        debug=debug,
        testing=testing,
        port=_env_int("PORT", 5000),
        mongodb_uri=_build_mongo_uri(),
        frontend_url=frontend_url,
        secret_key=secret_key,
        spotify_client_id=_env("SPOTIFY_CLIENT_ID"),
        spotify_client_secret=_env("SPOTIFY_CLIENT_SECRET"),
        spotify_redirect_uri=_env("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5000/auth/spotify/callback") or "http://127.0.0.1:5000/auth/spotify/callback",
        spotify_public_redirect_uri=_env("SPOTIFY_PUBLIC_REDIRECT_URI", "http://127.0.0.1:3000/spotify-success") or "http://127.0.0.1:3000/spotify-success",
        cookie_samesite=cookie_samesite,
        cookie_secure=cookie_secure,
        lastfm_api_key=_env("LASTFM_API_KEY"),
        lastfm_api_secret=_env("LASTFM_API_SECRET"),
        lastfm_redirect_uri=_env("LASTFM_REDIRECT_URI", "http://127.0.0.1:5000/auth/lastfm/callback") or "http://127.0.0.1:5000/auth/lastfm/callback",
        audio_features_provider=(_env("AUDIO_FEATURES_PROVIDER", "reccobeats") or "reccobeats").lower(),
        unsplash_access_key=_env("UNSPLASH_ACCESS_KEY"),
        pinterest_access_token=_env("PINTEREST_ACCESS_TOKEN"),
        redis_url=_env("REDIS_URL"),
        mlflow_tracking_uri=_env("MLFLOW_TRACKING_URI", "file:./backend/mlruns"),
        feature_store_mode=_env("FEATURE_STORE_MODE", "native") or "native",
        retrieval_model_version=_env("RETRIEVAL_MODEL_VERSION", "retrieval-two-tower-v1") or "retrieval-two-tower-v1",
        ranking_model_version=_env("RANKING_MODEL_VERSION", "ranker-v1") or "ranker-v1",
        soulmate_model_version=_env("SOULMATE_MODEL_VERSION", "soulmate-siamese-v1") or "soulmate-siamese-v1",
        enable_shadow_retrieval=_env_bool("ENABLE_SHADOW_RETRIEVAL", False),
        enable_shadow_ranker=_env_bool("ENABLE_SHADOW_RANKER", False),
        enable_learned_soulmate=_env_bool("ENABLE_LEARNED_SOULMATE", False),
        recommendation_canary_percent=_env_int("RECOMMENDATION_CANARY_PERCENT", 0),
        auralith_llm_provider=_env("AURALITH_LLM_PROVIDER", "openai_compatible") or "openai_compatible",
        auralith_llm_endpoint=_env("AURALITH_LLM_ENDPOINT"),
        auralith_llm_api_key=_env("AURALITH_LLM_API_KEY"),
        auralith_llm_model=_env("AURALITH_LLM_MODEL", "llama-3.1-8b-instant"),
        auralith_llm_timeout=_env_int("AURALITH_LLM_TIMEOUT", 20),
        auralith_llm_max_tokens=_env_int("AURALITH_LLM_MAX_TOKENS", 500),
        kafka_bootstrap_servers=_env("KAFKA_BOOTSTRAP_SERVERS"),
        kafka_events_topic=_env("KAFKA_EVENTS_TOPIC", "melodymap.events.v1") or "melodymap.events.v1",
        kafka_recommendation_feedback_topic=_env("KAFKA_RECOMMENDATION_FEEDBACK_TOPIC", "melodymap.recommendation.feedback.v1") or "melodymap.recommendation.feedback.v1",
        kafka_recommendation_request_topic=_env("KAFKA_RECOMMENDATION_REQUEST_TOPIC", "melodymap.recommendation.requests.v1") or "melodymap.recommendation.requests.v1",
        kafka_dlq_topic=_env("KAFKA_DLQ_TOPIC", "melodymap.events.dlq.v1") or "melodymap.events.dlq.v1",
    )


Config = get_config()

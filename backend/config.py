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
    lastfm_api_key: str | None
    lastfm_api_secret: str | None
    lastfm_redirect_uri: str
    unsplash_access_key: str | None
    pinterest_access_token: str | None

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
        }


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    environment = (_env("FLASK_ENV", "production") or "production").lower()
    testing = _env_bool("TESTING", False) or environment == "testing"
    debug = _env_bool("FLASK_DEBUG", False) or environment == "development"
    frontend_url = _env("FRONTEND_URL")
    if not frontend_url:
        frontend_url = "http://localhost:3000" if debug or testing else "https://melodymap.site"

    return AppConfig(
        environment=environment,
        debug=debug,
        testing=testing,
        port=_env_int("PORT", 5000),
        mongodb_uri=_build_mongo_uri(),
        frontend_url=frontend_url,
        secret_key=_env("SECRET_KEY", "dev-secret-key") or "dev-secret-key",
        spotify_client_id=_env("SPOTIFY_CLIENT_ID"),
        spotify_client_secret=_env("SPOTIFY_CLIENT_SECRET"),
        spotify_redirect_uri=_env("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5000/auth/spotify/callback") or "http://127.0.0.1:5000/auth/spotify/callback",
        spotify_public_redirect_uri=_env("SPOTIFY_PUBLIC_REDIRECT_URI", "http://127.0.0.1:3000/spotify-success") or "http://127.0.0.1:3000/spotify-success",
        lastfm_api_key=_env("LASTFM_API_KEY"),
        lastfm_api_secret=_env("LASTFM_API_SECRET"),
        lastfm_redirect_uri=_env("LASTFM_REDIRECT_URI", "http://127.0.0.1:5000/auth/lastfm/callback") or "http://127.0.0.1:5000/auth/lastfm/callback",
        unsplash_access_key=_env("UNSPLASH_ACCESS_KEY"),
        pinterest_access_token=_env("PINTEREST_ACCESS_TOKEN"),
    )


Config = get_config()

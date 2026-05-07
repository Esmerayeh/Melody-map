"""Regression tests for backend hardening and CI-safe startup behavior."""

import app as backend_app
from config import Config
from services.spotify_proxy_service import SpotifyProxyService


def test_create_app_root_response_is_structured():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    response = client.get("/")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["service"] == "melody-map-api"
    assert "environment" in payload["data"]


def test_health_route_degrades_gracefully_when_database_is_unreachable(monkeypatch):
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    class FakeDB:
        def command(self, _command):
            raise RuntimeError("mongo unavailable in test")

    monkeypatch.setattr(backend_app.mongo, "db", FakeDB(), raising=False)

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "degraded"
    assert payload["data"]["database"]["connected"] is False
    assert payload["warnings"][0]["code"] == "DATABASE_UNREACHABLE"


def test_spotify_proxy_service_rejects_missing_token_without_network():
    service = SpotifyProxyService()

    result = service.get("", "/me")

    assert result.ok is False
    assert result.status == 401
    assert result.error_code == "SPOTIFY_TOKEN_MISSING"


def test_spotify_data_route_returns_structured_error_without_token():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    response = client.get("/api/spotify/me")

    assert response.status_code == 401
    payload = response.get_json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "SPOTIFY_TOKEN_MISSING"


def test_music_profile_route_requires_token_with_consistent_error_shape():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    response = client.get("/api/music-profile")

    assert response.status_code == 401
    payload = response.get_json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "SPOTIFY_TOKEN_REQUIRED"


def test_session_bootstrap_reports_no_session_cleanly():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    response = client.get("/api/session/bootstrap")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["auth_state"] == "no_session"
    assert payload["data"]["music_provider"] is None
    assert payload["data"]["profile_boot_status"] == "awaiting_provider"


def test_session_bootstrap_reads_provider_cookies():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    client.set_cookie("mm_spotify_access", "spotify-cookie-token")

    response = client.get("/api/session/bootstrap")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["auth_state"] == "provider_connected"
    assert payload["data"]["music_provider"] == "spotify"
    assert payload["data"]["providers"]["spotify"]["connected"] is True


def test_root_response_carries_request_id_and_contract_version():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()

    response = client.get("/", headers={"X-Request-ID": "mm-test-request"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "mm-test-request"
    payload = response.get_json()
    assert payload["contractVersion"] == "2026-04-api-v1"
    assert payload["requestId"] == "mm-test-request"


def test_session_bootstrap_reads_app_session_cookie():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode(
        {"user_id": "user-123"},
        flask_app.config["SECRET_KEY"],
        algorithm="HS256",
    )
    client.set_cookie("mm_app_session", token)

    response = client.get("/api/session/bootstrap")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["auth_state"] == "authenticated"
    assert payload["data"]["user"]["id"] == "user-123"


def test_platform_config_defaults_are_safe_when_unset():
    assert Config.feature_store_mode in {"native", "redis", "feast"}
    assert Config.retrieval_model_version
    assert Config.ranking_model_version
    assert Config.soulmate_model_version
    assert isinstance(Config.enable_shadow_retrieval, bool)
    assert isinstance(Config.enable_shadow_ranker, bool)
    assert isinstance(Config.enable_learned_soulmate, bool)
    assert isinstance(Config.recommendation_canary_percent, int)

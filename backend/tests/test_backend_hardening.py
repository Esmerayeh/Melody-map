"""Regression tests for backend hardening and CI-safe startup behavior."""

import app as backend_app
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


import jwt
from flask import Flask

import routes.spotify_auth as spotify_auth


def test_spotify_app_session_mints_cookie_ready_user_token(monkeypatch):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "test-secret"
    monkeypatch.setattr(spotify_auth, "_spotify_profile", lambda token: {"id": "sp-123", "display_name": "Essie"})
    monkeypatch.setattr(spotify_auth, "_upsert_spotify_user", lambda profile: "melody-user-123")

    with app.app_context():
        session = spotify_auth.create_spotify_app_session("spotify-access-token")

    assert session["user_id"] == "melody-user-123"
    decoded = jwt.decode(session["token"], "test-secret", algorithms=["HS256"])
    assert decoded["user_id"] == "melody-user-123"
    assert session["display_name"] == "Essie"


def test_spotify_app_session_fails_closed_without_spotify_profile(monkeypatch):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "test-secret"
    monkeypatch.setattr(spotify_auth, "_spotify_profile", lambda token: None)

    with app.app_context():
        assert spotify_auth.create_spotify_app_session("bad-token") is None


def test_refresh_spotify_token_returns_none_without_token():
    assert spotify_auth.refresh_spotify_token("") is None
    assert spotify_auth.refresh_spotify_token(None) is None


def test_session_bootstrap_self_heals_expired_access_with_refresh(monkeypatch):
    """An authenticated user whose 1h access cookie expired but whose 30d
    refresh cookie survives must read as Spotify-connected: bootstrap mints a
    fresh access token and re-sets the cookies instead of reporting disconnected."""
    import app as appmod

    monkeypatch.setattr(
        appmod,
        "refresh_spotify_token",
        lambda rt: {"access_token": "NEW_ACCESS", "refresh_token": rt, "expires_in": 3600},
    )
    monkeypatch.setattr(
        appmod,
        "create_spotify_app_session",
        lambda token: {"user_id": "melody-user-123", "token": "app-jwt"},
    )

    client = appmod.app.test_client()
    client.set_cookie("mm_spotify_refresh", "REFRESH_123")
    response = client.get("/api/session/bootstrap")
    body = response.get_json()["data"]

    assert response.status_code == 200
    assert body["providers"]["spotify"]["connected"] is True
    assert body["music_provider"] == "spotify"
    assert body["auth_state"] == "authenticated"

    set_cookies = response.headers.get_all("Set-Cookie")
    assert any(c.startswith("mm_spotify_access=NEW_ACCESS") for c in set_cookies)


def test_session_bootstrap_no_cookies_stays_no_session():
    import app as appmod

    client = appmod.app.test_client()
    response = client.get("/api/session/bootstrap")
    body = response.get_json()["data"]

    assert response.status_code == 200
    assert body["auth_state"] == "no_session"
    assert body["providers"]["spotify"]["connected"] is False

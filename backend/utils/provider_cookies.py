from __future__ import annotations

from datetime import datetime, timedelta

from flask import Request

from utils.cookie_policy import cookie_kwargs


SPOTIFY_ACCESS_COOKIE = "mm_spotify_access"
SPOTIFY_REFRESH_COOKIE = "mm_spotify_refresh"
SPOTIFY_EXPIRES_COOKIE = "mm_spotify_expires_at"
LASTFM_SESSION_COOKIE = "mm_lastfm_session"
LASTFM_USERNAME_COOKIE = "mm_lastfm_username"


def _cookie_options(max_age: int | None = None) -> dict:
    return cookie_kwargs(max_age=max_age)


def set_spotify_cookies(response, *, access_token: str, refresh_token: str | None, expires_in: int | None) -> None:
    ttl = int(expires_in or 3600)
    expires_at = datetime.utcnow() + timedelta(seconds=ttl)
    response.set_cookie(SPOTIFY_ACCESS_COOKIE, access_token, **_cookie_options(max_age=ttl))
    response.set_cookie(SPOTIFY_EXPIRES_COOKIE, expires_at.isoformat() + "Z", **_cookie_options(max_age=ttl))
    if refresh_token:
        response.set_cookie(SPOTIFY_REFRESH_COOKIE, refresh_token, **_cookie_options(max_age=60 * 60 * 24 * 30))


def clear_spotify_cookies(response) -> None:
    for key in (SPOTIFY_ACCESS_COOKIE, SPOTIFY_REFRESH_COOKIE, SPOTIFY_EXPIRES_COOKIE):
        response.delete_cookie(key, path="/")


def set_lastfm_cookies(response, *, session_key: str, username: str) -> None:
    response.set_cookie(LASTFM_SESSION_COOKIE, session_key, **_cookie_options(max_age=60 * 60 * 24 * 30))
    response.set_cookie(LASTFM_USERNAME_COOKIE, username, **_cookie_options(max_age=60 * 60 * 24 * 30))


def clear_lastfm_cookies(response) -> None:
    for key in (LASTFM_SESSION_COOKIE, LASTFM_USERNAME_COOKIE):
        response.delete_cookie(key, path="/")


def spotify_context_from_request(request: Request) -> tuple[str | None, str | None, str | None]:
    access = request.cookies.get(SPOTIFY_ACCESS_COOKIE) or None
    refresh = request.cookies.get(SPOTIFY_REFRESH_COOKIE) or None
    expires_at = request.cookies.get(SPOTIFY_EXPIRES_COOKIE) or None
    return access, refresh, expires_at


def lastfm_context_from_request(request: Request) -> tuple[str | None, str | None]:
    session_key = request.cookies.get(LASTFM_SESSION_COOKIE) or None
    username = request.cookies.get(LASTFM_USERNAME_COOKIE) or None
    return session_key, username

"""HTTP-only cookie helpers for provider auth state."""

from __future__ import annotations

from flask import Request, Response

from config import Config

SPOTIFY_ACCESS_COOKIE = 'mm_spotify_access'
SPOTIFY_REFRESH_COOKIE = 'mm_spotify_refresh'
LASTFM_SESSION_COOKIE = 'mm_lastfm_session'
LASTFM_USERNAME_COOKIE = 'mm_lastfm_username'

COOKIE_MAX_AGE = 60 * 60 * 24 * 30


def _cookie_options(max_age: int = COOKIE_MAX_AGE) -> dict:
    secure = Config.environment == 'production'
    same_site = 'None' if secure else 'Lax'
    return {
        'httponly': True,
        'secure': secure,
        'samesite': same_site,
        'max_age': max_age,
        'path': '/',
    }


def set_cookie(response: Response, key: str, value: str, *, max_age: int = COOKIE_MAX_AGE) -> None:
    response.set_cookie(key, value, **_cookie_options(max_age=max_age))


def clear_cookie(response: Response, key: str) -> None:
    response.delete_cookie(
        key,
        path='/',
        secure=Config.environment == 'production',
        samesite='None' if Config.environment == 'production' else 'Lax',
    )


def get_cookie(request: Request, key: str) -> str | None:
    value = request.cookies.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def clear_spotify_cookies(response: Response) -> None:
    clear_cookie(response, SPOTIFY_ACCESS_COOKIE)
    clear_cookie(response, SPOTIFY_REFRESH_COOKIE)


def clear_lastfm_cookies(response: Response) -> None:
    clear_cookie(response, LASTFM_SESSION_COOKIE)
    clear_cookie(response, LASTFM_USERNAME_COOKIE)

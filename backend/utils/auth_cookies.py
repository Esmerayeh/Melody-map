from __future__ import annotations

from datetime import UTC, datetime, timedelta

from flask import Request

from utils.cookie_policy import cookie_kwargs


APP_SESSION_COOKIE = "mm_app_session"


def _cookie_options(max_age: int | None = None) -> dict:
    return cookie_kwargs(max_age=max_age)


def set_auth_cookie(response, token: str, *, ttl_seconds: int) -> None:
    response.set_cookie(APP_SESSION_COOKIE, token, **_cookie_options(max_age=ttl_seconds))


def clear_auth_cookie(response) -> None:
    response.delete_cookie(APP_SESSION_COOKIE, path="/")


def auth_token_from_request(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token:
            return token
    return request.cookies.get(APP_SESSION_COOKIE) or None


def auth_cookie_expiry(ttl_seconds: int) -> str:
    return (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).isoformat()

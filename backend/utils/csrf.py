from __future__ import annotations

import secrets

from flask import Request

from config import Config


CSRF_COOKIE = "mm_csrf"
CSRF_HEADER = "X-CSRF-Token"


def _cookie_options() -> dict:
    secure = Config.environment != "development" and not Config.testing
    return {
        "httponly": False,
        "secure": secure,
        "samesite": "Lax",
        "path": "/",
    }


def issue_csrf_token(response, request: Request | None = None) -> str:
    token = request.cookies.get(CSRF_COOKIE) if request else None
    token = token or secrets.token_urlsafe(24)
    response.set_cookie(CSRF_COOKIE, token, **_cookie_options())
    return token


def csrf_valid(request: Request) -> bool:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    return bool(cookie and header and secrets.compare_digest(cookie, header))

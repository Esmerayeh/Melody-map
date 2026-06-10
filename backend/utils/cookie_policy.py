"""Single source of truth for auth/provider/CSRF cookie attributes.

The SameSite/Secure pair is the difference between a working and a broken OAuth
return on the deployed Vercel (frontend) ↔ Render (backend) split: those are
different sites, so the post-callback `/exchange` and `/bootstrap` calls are
cross-site XHR, and browsers only send cookies on cross-site XHR when they are
`SameSite=None; Secure`. The values are derived once in `config.py` from the
frontend URL (local → `Lax`, deployed → `None; Secure`) and read here so every
cookie the app sets uses the same policy.
"""

from __future__ import annotations

from config import Config


def cookie_kwargs(*, max_age: int | None = None, http_only: bool = True) -> dict:
    return {
        "httponly": http_only,
        "secure": Config.cookie_secure,
        "samesite": Config.cookie_samesite,
        "max_age": max_age,
        "path": "/",
    }

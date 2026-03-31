"""Thin Spotify Web API proxy service for route-level use."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


SPOTIFY_API_ROOT = "https://api.spotify.com/v1"


@dataclass
class SpotifyProxyResult:
    ok: bool
    status: int
    data: dict | None = None
    error_message: str | None = None
    error_code: str | None = None


class SpotifyProxyService:
    def __init__(self, api_root: str = SPOTIFY_API_ROOT, timeout: int = 10) -> None:
        self.api_root = api_root.rstrip("/")
        self.timeout = timeout

    def build_headers(self, token: str | None) -> dict[str, str] | None:
        cleaned = (token or "").replace("Bearer ", "").strip()
        if not cleaned:
            return None
        return {"Authorization": f"Bearer {cleaned}"}

    def get(self, token: str | None, path: str, params: dict[str, Any] | None = None) -> SpotifyProxyResult:
        headers = self.build_headers(token)
        if headers is None:
            return SpotifyProxyResult(
                ok=False,
                status=401,
                error_message="Spotify token missing",
                error_code="SPOTIFY_TOKEN_MISSING",
            )

        try:
            response = requests.get(
                f"{self.api_root}{path}",
                headers=headers,
                params=params,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            return SpotifyProxyResult(
                ok=False,
                status=502,
                error_message="Spotify request failed",
                error_code="SPOTIFY_UPSTREAM_ERROR",
                data={"reason": str(exc)},
            )

        if response.status_code == 401:
            return SpotifyProxyResult(
                ok=False,
                status=401,
                error_message="Spotify token expired",
                error_code="TOKEN_EXPIRED",
            )

        if response.status_code == 429:
            return SpotifyProxyResult(
                ok=False,
                status=429,
                error_message="Spotify rate limit reached",
                error_code="SPOTIFY_RATE_LIMITED",
            )

        if not response.ok:
            details = None
            try:
                details = response.json()
            except ValueError:
                details = {"body": response.text}
            return SpotifyProxyResult(
                ok=False,
                status=502 if response.status_code >= 500 else response.status_code,
                error_message="Spotify request failed",
                error_code="SPOTIFY_REQUEST_FAILED",
                data=details,
            )

        return SpotifyProxyResult(ok=True, status=response.status_code, data=response.json())


spotify_proxy_service = SpotifyProxyService()


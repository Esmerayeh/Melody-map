from __future__ import annotations

import json
from typing import Any

from redis import Redis

from app.core.settings import get_settings


class CacheClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.client = Redis.from_url(settings.redis_url, decode_responses=True)

    def get_json(self, key: str) -> dict[str, Any] | None:
        raw = self.client.get(key)
        if not raw:
            return None
        return json.loads(raw)

    def set_json(self, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        self.client.setex(key, ttl_seconds, json.dumps(payload))

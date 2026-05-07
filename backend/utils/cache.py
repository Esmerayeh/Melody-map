from __future__ import annotations

import json
import threading
import time
from typing import Any

from config import Config

try:
    import redis
except Exception:  # pragma: no cover - optional dependency at runtime
    redis = None


class CacheStore:
    def __init__(self) -> None:
        self._memory: dict[str, tuple[float | None, str]] = {}
        self._lock = threading.Lock()
        self._client = None

        if redis and getattr(Config, "redis_url", None):
            try:
                self._client = redis.from_url(Config.redis_url, decode_responses=True)
            except Exception:
                self._client = None

    def _memory_get(self, key: str) -> str | None:
        with self._lock:
            entry = self._memory.get(key)
            if not entry:
                return None
            expires_at, payload = entry
            if expires_at is not None and expires_at < time.time():
                self._memory.pop(key, None)
                return None
            return payload

    def _memory_set(self, key: str, value: str, ttl_seconds: int | None) -> None:
        expires_at = time.time() + ttl_seconds if ttl_seconds else None
        with self._lock:
            self._memory[key] = (expires_at, value)

    def get_json(self, key: str) -> dict | None:
        raw = None
        if self._client:
            try:
                raw = self._client.get(key)
            except Exception:
                raw = None
        if raw is None:
            raw = self._memory_get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int | None = None) -> None:
        payload = json.dumps(value)
        if self._client:
            try:
                if ttl_seconds:
                    self._client.setex(key, ttl_seconds, payload)
                else:
                    self._client.set(key, payload)
                return
            except Exception:
                pass
        self._memory_set(key, payload, ttl_seconds)

    def delete(self, key: str) -> None:
        if self._client:
            try:
                self._client.delete(key)
            except Exception:
                pass
        with self._lock:
            self._memory.pop(key, None)


cache_store = CacheStore()

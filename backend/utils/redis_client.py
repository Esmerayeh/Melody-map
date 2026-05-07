from __future__ import annotations

import json

from config import Config

_redis = None


class InMemoryRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    def setex(self, key: str, _ttl_seconds: int, value: str) -> None:
        self._store[key] = value

    def get(self, key: str) -> str | None:
        return self._store.get(key)

    def ping(self) -> bool:
        return True

    def delete(self, key: str) -> int:
        existed = 1 if key in self._store else 0
        self._store.pop(key, None)
        return existed


def get_redis():
    global _redis
    if _redis is not None:
        return _redis

    if Config.testing or Config.debug or Config.environment == "development":
        _redis = InMemoryRedis()
        return _redis

    try:
        import redis  # type: ignore

        if not Config.redis_url:
            _redis = InMemoryRedis()
            return _redis
        _redis = redis.from_url(Config.redis_url, decode_responses=True)
        _redis.ping()
        return _redis
    except Exception:
        if Config.testing or Config.debug or Config.environment == "development":
            _redis = InMemoryRedis()
            return _redis
        raise


def redis_available() -> bool:
    try:
        return bool(get_redis().ping())
    except Exception:
        return False


def redis_write_json(key: str, payload: dict, ttl_seconds: int = 900) -> None:
    get_redis().setex(key, ttl_seconds, json.dumps(payload, default=str))


def redis_read_json(key: str) -> dict | None:
    raw = get_redis().get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def redis_delete(key: str) -> None:
    try:
        get_redis().delete(key)
    except Exception:
        return


def using_inmemory_redis() -> bool:
    try:
        return isinstance(get_redis(), InMemoryRedis)
    except Exception:
        return False

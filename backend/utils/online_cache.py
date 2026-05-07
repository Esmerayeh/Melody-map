from __future__ import annotations

from utils.redis_client import redis_read_json, redis_write_json


def online_feature_key(user_id: str) -> str:
    return f"melodymap:online-features:{user_id}"


def session_feature_key(user_id: str) -> str:
    return f"melodymap:session-features:{user_id}"


def request_trace_key(request_id: str) -> str:
    return f"melodymap:recommendation-request:{request_id}"


def write_live_signal(user_id: str, payload: dict, ttl_seconds: int = 900) -> None:
    redis_write_json(online_feature_key(user_id), payload, ttl_seconds=ttl_seconds)


def read_live_signal(user_id: str) -> dict | None:
    return redis_read_json(online_feature_key(user_id))


def write_session_features(user_id: str, payload: dict, ttl_seconds: int = 900) -> None:
    redis_write_json(session_feature_key(user_id), payload, ttl_seconds=ttl_seconds)


def read_session_features(user_id: str) -> dict | None:
    return redis_read_json(session_feature_key(user_id))


def write_request_trace(request_id: str, payload: dict, ttl_seconds: int = 86400) -> None:
    redis_write_json(request_trace_key(request_id), payload, ttl_seconds=ttl_seconds)


def read_request_trace(request_id: str) -> dict | None:
    return redis_read_json(request_trace_key(request_id))

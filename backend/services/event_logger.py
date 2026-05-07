from __future__ import annotations

from datetime import UTC, datetime

from services.feature_store import store_listening_event
from services.kafka_producer import publish_event


EVENT_SCHEMA_VERSION = "2026-05-events-v1"
ALLOWED_EVENT_TYPES = {
    "play",
    "skip",
    "save",
    "search",
    "recommendation_impression",
    "recommendation_click",
    "recommendation_save",
    "recommendation_skip",
    "recommendation_replay",
    "recommendation_dwell",
    "recommendation_abandon",
    "open_auralith_result",
    "listening",
}
ALLOWED_SURFACES = {"galaxy", "auralith", "discover", "analytics", "soulmate", "recommendations"}


def normalize_event_payload(user_id: str, payload: dict, request_id: str | None = None) -> dict:
    event_type = payload.get("type", "listening")
    if event_type not in ALLOWED_EVENT_TYPES:
        raise ValueError(f"unsupported event type: {event_type}")

    context = payload.get("context") or {}
    surface = context.get("surface")
    if surface and surface not in ALLOWED_SURFACES:
        raise ValueError(f"unsupported event surface: {surface}")

    timestamp = payload.get("timestamp") or datetime.now(UTC).isoformat()
    return {
        "schema_version": EVENT_SCHEMA_VERSION,
        "user_id": user_id,
        "type": event_type,
        "track_id": payload.get("track_id"),
        "artist": payload.get("artist"),
        "title": payload.get("title"),
        "session_id": payload.get("session_id"),
        "context": {
            "surface": surface,
            "query": context.get("query"),
            "playlist_id": context.get("playlist_id"),
            "recommendation_id": context.get("recommendation_id"),
            "position": context.get("position"),
            "candidate_source": context.get("candidate_source"),
            "model_version": context.get("model_version"),
            "request_id": request_id,
        },
        "timestamp": timestamp,
    }


def log_event(user_id: str, payload: dict, *, request_id: str | None = None, event_id: str | None = None) -> dict:
    normalized = normalize_event_payload(user_id, payload, request_id=request_id)
    stored = store_listening_event(user_id, normalized, event_id=event_id)
    publish_event(stored)
    return stored

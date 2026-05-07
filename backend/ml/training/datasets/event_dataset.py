from __future__ import annotations

from datetime import datetime


def _track_key(event: dict) -> str:
    return str(event.get("track_id") or f"{event.get('title', 'unknown')}::{event.get('artist', 'unknown')}")


def load_listening_events(limit: int | None = None) -> list[dict]:
    from app import mongo

    if getattr(mongo, "db", None) is None:
        return []
    cursor = mongo.db.listening_events.find().sort("received_at", -1)
    if limit:
        cursor = cursor.limit(limit)
    docs = list(cursor)
    for doc in docs:
        doc.pop("_id", None)
    return docs


def sessionize_events(events: list[dict], gap_minutes: int = 30) -> list[dict]:
    sessionized = []
    last_seen: dict[str, datetime] = {}
    counters: dict[str, int] = {}
    for event in sorted(events, key=lambda item: item.get("timestamp") or ""):
        user_id = event.get("user_id") or "unknown"
        ts = datetime.fromisoformat((event.get("timestamp") or datetime.utcnow().isoformat()).replace("Z", "+00:00"))
        previous = last_seen.get(user_id)
        if previous is None or (ts - previous).total_seconds() > gap_minutes * 60:
            counters[user_id] = counters.get(user_id, 0) + 1
        last_seen[user_id] = ts
        enriched = dict(event)
        enriched["session_id"] = event.get("session_id") or f"{user_id}-session-{counters[user_id]}"
        sessionized.append(enriched)
    return sessionized


def build_interaction_rows(events: list[dict]) -> list[dict]:
    rows = []
    for event in sessionize_events(events):
        context = event.get("context") or {}
        rows.append(
            {
                "user_id": event.get("user_id"),
                "track_key": _track_key(event),
                "event_type": event.get("type", "listening"),
                "timestamp": event.get("timestamp"),
                "session_id": event.get("session_id"),
                "surface": context.get("surface"),
                "position": context.get("position"),
                "query": context.get("query"),
            }
        )
    return rows

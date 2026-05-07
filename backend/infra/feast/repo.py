from __future__ import annotations

import pandas as pd

from services.feature_store import get_online_features


def export_user_profile_features() -> "pd.DataFrame":
    from app import mongo

    rows = []
    docs = list(mongo.db.profile_snapshots.find().sort("captured_at", -1).limit(500)) if getattr(mongo, "db", None) is not None else []
    for doc in docs:
        payload = doc.get("payload") or {}
        reps = payload.get("representations") or {}
        analytics = payload.get("analyticsMetrics") or {}
        rows.append(
            {
                "user_id": doc.get("user_id") or doc.get("provider_user_id"),
                "snapshot_id": doc.get("snapshot_id"),
                "profile_vector": reps.get("profileVector"),
                "genres": [item.get("genre", item) if isinstance(item, dict) else item for item in payload.get("genres", [])[:8]],
                "mood": analytics.get("mood"),
                "confidence_score": ((payload.get("confidence") or {}).get("overall") or {}).get("score"),
            }
        )
    return pd.DataFrame(rows)


def export_track_features() -> "pd.DataFrame":
    from app import mongo

    rows = []
    docs = list(mongo.db.songs.find().limit(1000)) if getattr(mongo, "db", None) is not None else []
    for doc in docs:
        rows.append(
            {
                "track_key": str(doc.get("_id") or doc.get("id") or doc.get("spotify_id") or doc.get("title")),
                "title": doc.get("title"),
                "artist": doc.get("artist"),
                "genre": doc.get("genre"),
                "popularity": doc.get("popularity"),
                "embedding_version": doc.get("embedding_version"),
            }
        )
    return pd.DataFrame(rows)


def export_session_features() -> "pd.DataFrame":
    from app import mongo

    rows = []
    if getattr(mongo, "db", None) is None:
        return pd.DataFrame(rows)
    docs = list(mongo.db.listening_events.find().sort("received_at", -1).limit(1000))
    for doc in docs:
        online = get_online_features(doc.get("user_id")) or {}
        live_signal = online.get("live_signal") or {}
        rows.append(
            {
                "session_id": doc.get("session_id") or doc.get("context", {}).get("session_id") or doc.get("event_id"),
                "user_id": doc.get("user_id"),
                "surface": (doc.get("context") or {}).get("surface"),
                "recent_event_count": live_signal.get("eventCount", 0),
                "last_track_key": doc.get("track_id") or doc.get("title"),
            }
        )
    return pd.DataFrame(rows)

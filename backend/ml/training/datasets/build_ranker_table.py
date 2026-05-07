from __future__ import annotations

from services.feature_store import get_embedding


def build_ranker_rows(interactions: list[dict], candidates: list[dict]) -> list[dict]:
    positive_events = {
        "recommendation_click",
        "recommendation_save",
        "recommendation_replay",
        "save",
        "play",
    }
    clicked = {(row.get("user_id"), row.get("track_key")) for row in interactions if row.get("event_type") in positive_events}
    rows = []
    for candidate in candidates:
        user_id = candidate.get("user_id")
        track_key = candidate.get("track_key")
        user_embedding = get_embedding("profile", str(user_id), candidate.get("embedding_version"))
        item_embedding = get_embedding("track", str(track_key), candidate.get("embedding_version"))
        rows.append(
            {
                "user_id": user_id,
                "track_key": track_key,
                "label": 1 if (user_id, track_key) in clicked else 0,
                "retrieval_score": candidate.get("score", 0.0),
                "popularity": candidate.get("popularity", 0.0),
                "novelty": candidate.get("novelty", 0.0),
                "repeat_pressure": candidate.get("repeat_pressure", 0.0),
                "mood_compatibility": candidate.get("mood_compatibility", 0.0),
                "freshness": candidate.get("freshness", 0.0),
                "user_vector": (user_embedding or {}).get("vector", []),
                "session_vector": candidate.get("session_vector", []),
                "item_vector": (item_embedding or {}).get("vector", []),
            }
        )
    return rows

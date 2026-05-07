from __future__ import annotations

from services.feature_store import summarize_live_signal, upsert_online_features_cached
from utils.logger import logger


def process_event(payload: dict) -> dict | None:
    user_id = payload.get("user_id")
    if not user_id:
        return None
    signal = summarize_live_signal(user_id, limit=24)
    upsert_online_features_cached(user_id, signal, source_event_id=payload.get("event_id"))
    logger.info({"event": "session_feature_updated", "user_id": user_id, "event_id": payload.get("event_id")})
    return signal

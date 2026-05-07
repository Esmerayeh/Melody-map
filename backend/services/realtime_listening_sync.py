from __future__ import annotations

from datetime import UTC, datetime

from services.feature_store import store_listening_event, summarize_live_signal, upsert_online_features_cached
from services.kafka_producer import publish_event
from services.spotify_proxy_service import spotify_proxy_service
from utils.logger import logger


def _normalize_current_track(item: dict, *, surface: str = "realtime_sync") -> dict | None:
    if not item:
        return None
    track = item.get("item") if item.get("item") else item.get("track", item)
    if not track:
        return None
    played_at = item.get("played_at") or datetime.now(UTC).isoformat()
    return {
        "track_id": track.get("id"),
        "title": track.get("name"),
        "artist": ((track.get("artists") or [{}])[0]).get("name"),
        "album": (track.get("album") or {}).get("name"),
        "preview_url": track.get("preview_url"),
        "spotify_url": (track.get("external_urls") or {}).get("spotify"),
        "played_at": played_at,
        "timestamp": played_at,
        "context": {
            "surface": surface,
            "is_current": bool(item.get("is_playing")),
            "played_at": played_at,
        },
    }


def sync_spotify_listening(user_id: str, spotify_token: str) -> dict:
    current_result = spotify_proxy_service.get(spotify_token, "/me/player/currently-playing")
    recent_result = spotify_proxy_service.get(spotify_token, "/me/player/recently-played", {"limit": 10})
    inserted = 0
    deduped = 0
    current_track = None
    events = []

    if current_result.ok and current_result.data:
        normalized = _normalize_current_track(current_result.data)
        if normalized:
            event_id = f"rt:{normalized['track_id']}:{normalized['played_at']}"
            event = store_listening_event(user_id, {"type": "play", **normalized}, event_id=event_id)
            if event.get("_inserted"):
                inserted += 1
            else:
                deduped += 1
            current_track = normalized
            events.append(event)

    if recent_result.ok and recent_result.data:
        for item in recent_result.data.get("items", []):
            normalized = _normalize_current_track(item, surface="recently_played")
            if not normalized or not normalized.get("track_id"):
                continue
            event_id = f"rt:{normalized['track_id']}:{normalized['played_at']}"
            existing = store_listening_event(user_id, {"type": "play", **normalized}, event_id=event_id)
            if existing.get("_inserted"):
                inserted += 1
                events.append(existing)
            else:
                deduped += 1

    signal = summarize_live_signal(user_id, limit=24)
    if current_track:
        signal["currentTrack"] = {
            "track_id": current_track.get("track_id"),
            "title": current_track.get("title"),
            "artist": current_track.get("artist"),
            "album": current_track.get("album"),
            "preview_url": current_track.get("preview_url"),
            "spotify_url": current_track.get("spotify_url"),
        }
    upsert_online_features_cached(user_id, signal, source_event_id=events[-1]["event_id"] if events else None)
    for event in events:
        publish_event(event, key=event.get("event_id"))
    logger.info({"event": "realtime_listening_sync_complete", "user_id": user_id, "inserted": inserted, "deduped": deduped})
    return {"inserted": inserted, "deduped": deduped, "current_track": current_track, "live_signal": signal}

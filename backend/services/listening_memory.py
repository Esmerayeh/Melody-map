from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any

from services.feature_store import get_latest_snapshot, get_recent_events, list_identity_snapshots, summarize_live_signal


MEMORY_SCHEMA_VERSION = "2026-05-listening-memory-v1"


def _label(item: Any, *keys: str) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for key in keys:
            value = item.get(key)
            if value:
                return str(value).strip()
    return ""


def _track_label(track: Any) -> str:
    if isinstance(track, str):
        return track.strip()
    if not isinstance(track, dict):
        return ""
    title = track.get("title") or track.get("name") or ""
    artist = track.get("artist") or ""
    if not artist and isinstance(track.get("artists"), list) and track["artists"]:
        first = track["artists"][0]
        artist = first.get("name") if isinstance(first, dict) else str(first)
    return " by ".join(part for part in [title, artist] if part)


def _parse_time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except (TypeError, ValueError):
        return None


def _pct(value: float) -> int:
    return int(round(max(0.0, min(1.0, value)) * 100))


def _profile_payload(user_id: str | None, profile: dict | None) -> dict:
    if profile:
        return profile
    snapshot = get_latest_snapshot(user_id) if user_id else None
    return (snapshot or {}).get("payload") or {}


def _snapshot_payloads(user_id: str | None, profile: dict) -> list[dict]:
    stored = [doc.get("payload", doc) for doc in (list_identity_snapshots(user_id) if user_id else [])]
    if stored:
        return stored
    if profile:
        return [{
            "range": profile.get("timeRange") or "current",
            "captured_at": profile.get("generatedAt"),
            "top_artists": [_label(item, "name", "artist") for item in (profile.get("topArtists") or [])[:10]],
            "top_genres": [_label(item, "genre", "name") for item in (profile.get("genres") or [])[:10]],
            "mood_vector": {
                "energy": (profile.get("audioFeatures") or {}).get("energy"),
                "valence": (profile.get("audioFeatures") or {}).get("valence"),
                "danceability": (profile.get("audioFeatures") or {}).get("danceability"),
                "mood": (profile.get("analyticsMetrics") or {}).get("mood"),
            },
            "identity_signals": {
                signal.get("id"): {
                    "label": signal.get("label"),
                    "pct": signal.get("pct"),
                    "evidence": (signal.get("evidence") or [])[:3],
                }
                for signal in (profile.get("identitySignals") or [])
                if isinstance(signal, dict) and signal.get("id") and signal.get("available", True)
            },
            "spotify_receipts": ((profile.get("spotifyEvidence") or profile.get("listeningEvidence") or {}).get("receipts") or [])[:8],
        }]
    return []


def _events_from_profile(profile: dict) -> list[dict]:
    events = []
    for track in profile.get("recentlyPlayed") or []:
        if not isinstance(track, dict):
            continue
        events.append({
            "title": track.get("title") or track.get("name"),
            "artist": track.get("artist"),
            "track_id": track.get("id") or track.get("spotify_id"),
            "timestamp": track.get("played_at") or track.get("timestamp"),
            "played_at": track.get("played_at"),
            "audio_features": track.get("audio_features") or track.get("audioFeatures"),
        })
    return events


def _count_labels(values: list[str], limit: int = 8) -> list[dict]:
    counter = Counter(item for item in values if item)
    return [
        {"label": label, "count": count}
        for label, count in counter.most_common(limit)
    ]


def build_listening_memory_model(user_id: str | None, profile: dict | None = None) -> dict:
    payload = _profile_payload(user_id, profile)
    snapshots = _snapshot_payloads(user_id, payload)
    stored_events = get_recent_events(user_id, limit=120) if user_id else []
    events = stored_events or _events_from_profile(payload)
    live_signal = summarize_live_signal(user_id, limit=40) if user_id else {}

    artist_values: list[str] = []
    genre_values: list[str] = []
    track_values: list[str] = []
    era_rows = []

    for snapshot in snapshots:
        artists = snapshot.get("top_artists") or [_label(item, "name", "artist") for item in (snapshot.get("topArtists") or [])]
        genres = snapshot.get("top_genres") or [_label(item, "genre", "name") for item in (snapshot.get("genres") or [])]
        artist_values.extend([item for item in artists if item])
        genre_values.extend([item for item in genres if item])
        mood_vector = snapshot.get("mood_vector") or {}
        era_rows.append({
            "range": snapshot.get("range") or snapshot.get("timeRange") or "current",
            "capturedAt": snapshot.get("captured_at") or snapshot.get("generatedAt"),
            "artists": artists[:5],
            "genres": genres[:5],
            "mood": mood_vector.get("mood"),
            "energy": mood_vector.get("energy"),
            "valence": mood_vector.get("valence"),
            "receipts": (snapshot.get("spotify_receipts") or [])[:4],
        })

    for track in payload.get("topTracks") or []:
        track_values.append(_track_label(track))
    for event in events:
        track_values.append(_track_label(event))
        artist_values.append(_label(event, "artist"))

    late_events = []
    dated_events = []
    for event in events:
        when = _parse_time(event.get("played_at") or event.get("timestamp"))
        if not when:
            continue
        dated_events.append(event)
        if when.hour >= 22 or when.hour < 5:
            late_events.append(event)

    recurring_artists = _count_labels(artist_values)
    recurring_tracks = _count_labels(track_values)
    recurring_genres = _count_labels(genre_values)
    repeat_score = live_signal.get("repeatScore")
    if repeat_score is None and track_values:
        repeat_score = 1.0 - (len(set(track_values)) / max(len(track_values), 1))
    repeat_score = max(0.0, min(1.0, float(repeat_score or 0.0)))

    nocturnal_score = (len(late_events) / len(dated_events)) if dated_events else None
    nostalgia_index = ((payload.get("analyticsMetrics") or {}).get("nostalgiaIndex") or 0) / 100.0
    comfort_orbit = min(1.0, repeat_score * 0.55 + min(1.0, len([item for item in recurring_artists if item["count"] >= 2]) / 5.0) * 0.45)

    signal_counter = Counter()
    signal_receipts: dict[str, list[str]] = defaultdict(list)
    for snapshot in snapshots:
        for signal in (snapshot.get("identity_signals") or {}).values():
            if not isinstance(signal, dict):
                continue
            label = signal.get("label")
            pct = signal.get("pct") or 0
            if label:
                signal_counter[label] += max(1, int(pct))
                signal_receipts[label].extend(signal.get("evidence") or [])

    motifs = []
    for label, _ in signal_counter.most_common(5):
        motifs.append({
            "label": label,
            "evidence": list(dict.fromkeys(signal_receipts[label]))[:4],
            "source": "identity snapshots",
        })
    if recurring_genres:
        motifs.append({
            "label": "Genre cycle",
            "evidence": [f"Recurring genre anchors: {', '.join(item['label'] for item in recurring_genres[:5])}."],
            "source": "top artist genres",
        })
    if nocturnal_score is not None:
        motifs.append({
            "label": "Night listening",
            "evidence": [f"{len(late_events)} of {len(dated_events)} timestamped plays happened late at night."],
            "source": "recent Spotify timestamps",
        })

    statements = []
    if recurring_artists:
        statements.append(f"You keep returning to {', '.join(item['label'] for item in recurring_artists[:4])}.")
    if recurring_tracks and repeat_score >= 0.2:
        statements.append(f"Your comfort orbit is visible through repeated tracks like {', '.join(item['label'] for item in recurring_tracks[:3])}.")
    if nocturnal_score is not None and nocturnal_score >= 0.35:
        statements.append("Your listening memory has a real late-night shape.")
    if nostalgia_index >= 0.35:
        statements.append(f"Your nostalgia recurrence is {_pct(nostalgia_index)}%, based on saved/repeated older anchors.")
    if not statements:
        statements.append("Melody Map has the first outline of your listening memory, but needs more snapshots or recent plays before making stronger continuity claims.")

    confidence_score = min(
        0.92,
        0.2
        + min(len(snapshots), 4) * 0.12
        + min(len(events), 40) * 0.006
        + (0.12 if recurring_artists else 0.0)
        + (0.1 if motifs else 0.0),
    )

    return {
        "schemaVersion": MEMORY_SCHEMA_VERSION,
        "available": bool(payload and (snapshots or events or payload.get("topArtists") or payload.get("topTracks"))),
        "historyDepth": len(snapshots),
        "eventDepth": len(events),
        "timeline": era_rows[-8:],
        "recurringArtists": recurring_artists,
        "recurringTracks": recurring_tracks,
        "recurringGenres": recurring_genres,
        "motifs": motifs[:8],
        "comfortOrbit": {
            "score": round(comfort_orbit, 3),
            "pct": _pct(comfort_orbit),
            "evidence": statements[:3],
        },
        "nightListening": {
            "available": nocturnal_score is not None,
            "score": round(nocturnal_score or 0.0, 3),
            "pct": _pct(nocturnal_score or 0.0),
            "lateNightCount": len(late_events),
            "sampleSize": len(dated_events),
        },
        "nostalgiaRecurrence": {
            "score": round(nostalgia_index, 3),
            "pct": _pct(nostalgia_index),
            "source": "analyticsMetrics.nostalgiaIndex and recurrence proxies",
        },
        "memoryStatements": statements[:5],
        "confidence": {
            "score": round(confidence_score, 3),
            "label": "high" if confidence_score >= 0.72 else "medium" if confidence_score >= 0.48 else "low",
        },
        "limitations": [] if len(snapshots) >= 2 else ["Temporal memory is still forming; more stored snapshots will make eras and drift more reliable."],
        "derivedFrom": ["profile snapshots", "identity snapshots", "recent listening events", "top artists", "top tracks", "genres"],
    }

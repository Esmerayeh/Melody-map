from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from services.feature_store import list_identity_snapshots, upsert_identity_snapshot


RANGE_MAP = {
    "monthly": "short_term",
    "quarterly": "medium_term",
    "half_year": "long_term",
    "all": "all_time",
}


def snapshot_from_profile(profile: dict, range_key: str) -> dict:
    personality = profile.get("personality") or []
    mbti = profile.get("mbti") or {}
    genres = profile.get("genres") or []
    top_artists = profile.get("topArtists") or []
    audio = profile.get("audioFeatures") or {}
    analytics = profile.get("analyticsMetrics") or {}
    return {
        "range": range_key,
        "captured_at": profile.get("generatedAt") or datetime.now(UTC).isoformat(),
        "archetype_scores": {item.get("label"): item.get("pct", item.get("score", 0)) for item in personality if isinstance(item, dict) and item.get("label")},
        "mbti": mbti,
        "music_identity": profile.get("musicIdentity") or {},
        "sonic_axes": profile.get("sonicAxes") or [],
        "identity_metrics": profile.get("identityMetrics") or [],
        "sonic_field": profile.get("sonicField") or {},
        "top_artists": [item.get("name") if isinstance(item, dict) else str(item) for item in top_artists[:10]],
        "top_genres": [item.get("genre") if isinstance(item, dict) else str(item) for item in genres[:10]],
        "audio_averages": audio,
        "identity_signals": {
            item.get("id"): {
                "label": item.get("label"),
                "pct": item.get("pct"),
                "score": item.get("score"),
                "evidence": (item.get("evidence") or [])[:3],
            }
            for item in (profile.get("identitySignals") or [])
            if isinstance(item, dict) and item.get("id") and item.get("available", True)
        },
        "living_identity": profile.get("livingIdentity") or {},
        "spotify_receipts": ((profile.get("spotifyEvidence") or {}).get("receipts") or [])[:8],
        "mood_vector": {
            "energy": audio.get("energy", 0.0),
            "valence": audio.get("valence", 0.0),
            "danceability": audio.get("danceability", 0.0),
            "mood": analytics.get("mood"),
        },
        "aesthetic_label": (profile.get("aesthetic") or {}).get("name") or analytics.get("mood"),
    }


def store_identity_snapshot(user_id: str, range_key: str, profile: dict) -> dict:
    snapshot = snapshot_from_profile(profile, range_key)
    upsert_identity_snapshot(user_id, range_key, snapshot)
    return snapshot


def compute_drift(snapshots: list[dict]) -> dict:
    ordered = [item.get("payload", item) for item in snapshots]
    if len(ordered) < 2:
        receipts = ordered[0].get("spotify_receipts", []) if ordered else []
        return {
            "availableHistory": False,
            "historyDepth": len(ordered),
            "archetypeChange": None,
            "mbtiAxisShift": None,
            "sonicAxisShift": None,
            "identityMetricShift": None,
            "genreMovement": [],
            "energyValenceMovement": {"energyDelta": 0.0, "valenceDelta": 0.0},
            "newArtists": [],
            "recurringArtists": ordered[0].get("top_artists", []) if ordered else [],
            "evolutionNarrative": "Melody Map has one Spotify identity snapshot so far. It will describe real drift after at least two stored listening states exist.",
            "receipts": receipts,
            "needsMoreSnapshots": True,
        }
    first = ordered[0]
    last = ordered[-1]
    first_archetypes = first.get("archetype_scores", {})
    last_archetypes = last.get("archetype_scores", {})
    all_traits = sorted(set(first_archetypes) | set(last_archetypes))
    archetype_change = {trait: round(float(last_archetypes.get(trait, 0)) - float(first_archetypes.get(trait, 0)), 3) for trait in all_traits}
    first_mbti = (first.get("mbti") or {}).get("axes", {})
    last_mbti = (last.get("mbti") or {}).get("axes", {})
    all_axes = sorted(set(first_mbti) | set(last_mbti))
    mbti_shift = {axis: round(float((last_mbti.get(axis) or {}).get("score", 0)) - float((first_mbti.get(axis) or {}).get("score", 0)), 3) for axis in all_axes}
    first_sonic_axes = {axis.get("id"): axis for axis in first.get("sonic_axes", []) if isinstance(axis, dict) and axis.get("id")}
    last_sonic_axes = {axis.get("id"): axis for axis in last.get("sonic_axes", []) if isinstance(axis, dict) and axis.get("id")}
    sonic_axis_shift = {
        axis: round(float((last_sonic_axes.get(axis) or {}).get("balance", 0)) - float((first_sonic_axes.get(axis) or {}).get("balance", 0)), 3)
        for axis in sorted(set(first_sonic_axes) | set(last_sonic_axes))
    }
    first_metrics = {metric.get("id"): metric for metric in first.get("identity_metrics", []) if isinstance(metric, dict) and metric.get("id")}
    last_metrics = {metric.get("id"): metric for metric in last.get("identity_metrics", []) if isinstance(metric, dict) and metric.get("id")}
    metric_shift = {
        metric: round(float((last_metrics.get(metric) or {}).get("score", 0) or 0) - float((first_metrics.get(metric) or {}).get("score", 0) or 0), 3)
        for metric in sorted(set(first_metrics) | set(last_metrics))
    }
    first_genres = first.get("top_genres", [])
    last_genres = last.get("top_genres", [])
    first_audio = first.get("audio_averages", {})
    last_audio = last.get("audio_averages", {})
    recurring = sorted(set(first.get("top_artists", [])) & set(last.get("top_artists", [])))
    new_artists = sorted(set(last.get("top_artists", [])) - set(first.get("top_artists", [])))
    departed_artists = sorted(set(first.get("top_artists", [])) - set(last.get("top_artists", [])))
    strongest_trait = max(archetype_change.items(), key=lambda item: abs(item[1]))[0] if archetype_change else "Soft signal"
    strongest_axis = max(mbti_shift.items(), key=lambda item: abs(item[1]))[0] if mbti_shift else "Soft signal"
    strongest_sonic_axis = max(sonic_axis_shift.items(), key=lambda item: abs(item[1]))[0] if sonic_axis_shift else None
    first_signals = first.get("identity_signals", {})
    last_signals = last.get("identity_signals", {})
    signal_ids = sorted(set(first_signals) | set(last_signals))
    signal_shift = {
        signal_id: {
            "label": (last_signals.get(signal_id) or first_signals.get(signal_id) or {}).get("label") or signal_id,
            "delta": round(float((last_signals.get(signal_id) or {}).get("pct") or 0) - float((first_signals.get(signal_id) or {}).get("pct") or 0), 2),
            "latestEvidence": (last_signals.get(signal_id) or {}).get("evidence", []),
        }
        for signal_id in signal_ids
    }
    strongest_signal = max(signal_shift.values(), key=lambda item: abs(item["delta"])) if signal_shift else None
    audio_movement = {
        "energyDelta": round(float(last_audio.get("energy", 0)) - float(first_audio.get("energy", 0)), 3),
        "valenceDelta": round(float(last_audio.get("valence", 0)) - float(first_audio.get("valence", 0)), 3),
        "danceabilityDelta": round(float(last_audio.get("danceability", 0)) - float(first_audio.get("danceability", 0)), 3),
        "acousticnessDelta": round(float(last_audio.get("acousticness", 0)) - float(first_audio.get("acousticness", 0)), 3),
    }
    genre_migration = [genre for genre in last_genres if genre not in first_genres] or [genre for genre in first_genres if genre not in last_genres]
    artist_counter = Counter()
    for snapshot in ordered:
        artist_counter.update(snapshot.get("top_artists", []))
    repeated_artists = [artist for artist, count in artist_counter.most_common(8) if count >= 2]
    receipts = []
    if recurring:
        receipts.append(f"Recurring top artists across snapshots: {', '.join(recurring[:5])}.")
    if new_artists:
        receipts.append(f"Newer top artist anchors: {', '.join(new_artists[:5])}.")
    if genre_migration:
        receipts.append(f"Genre movement touched {', '.join(genre_migration[:5])}.")
    if strongest_signal:
        receipts.append(f"{strongest_signal['label']} moved {strongest_signal['delta']} points between stored Spotify snapshots.")
    if audio_movement["valenceDelta"]:
        direction = "brighter" if audio_movement["valenceDelta"] > 0 else "darker"
        receipts.append(f"Average valence moved {direction} by {abs(audio_movement['valenceDelta'])}.")
    evolution = _build_evolution_narrative(
        strongest_signal=strongest_signal,
        audio_movement=audio_movement,
        new_artists=new_artists,
        recurring=recurring,
        genre_migration=genre_migration,
    )
    return {
        "availableHistory": True,
        "historyDepth": len(ordered),
        "from": first.get("captured_at"),
        "to": last.get("captured_at"),
        "archetypeChange": strongest_trait,
        "mbtiAxisShift": strongest_axis,
        "sonicAxisShift": strongest_sonic_axis,
        "identityMetricShift": metric_shift,
        "genreMovement": genre_migration,
        "energyValenceMovement": audio_movement,
        "newArtists": new_artists,
        "recurringArtists": recurring,
        "repeatedArtistMemory": repeated_artists,
        "identitySignalShift": signal_shift,
        "strongestIdentityMovement": strongest_signal,
        "evolutionNarrative": evolution,
        "receipts": receipts[:8],
        "needsMoreSnapshots": False,
        "departedArtists": departed_artists,
        "raw": {
            "archetypeChange": archetype_change,
            "mbtiAxisShift": mbti_shift,
            "sonicAxisShift": sonic_axis_shift,
            "identityMetricShift": metric_shift,
        },
    }


def _build_evolution_narrative(
    *,
    strongest_signal: dict | None,
    audio_movement: dict,
    new_artists: list[str],
    recurring: list[str],
    genre_migration: list[str],
) -> str:
    parts = []
    if strongest_signal and strongest_signal.get("delta"):
        direction = "grew" if strongest_signal["delta"] > 0 else "softened"
        parts.append(f"Your {strongest_signal['label'].lower()} {direction} by {abs(strongest_signal['delta'])} points.")
    if audio_movement.get("valenceDelta"):
        direction = "brighter" if audio_movement["valenceDelta"] > 0 else "darker"
        parts.append(f"Your average emotional brightness became {direction}.")
    if audio_movement.get("energyDelta"):
        direction = "more charged" if audio_movement["energyDelta"] > 0 else "quieter"
        parts.append(f"Your energy profile became {direction}.")
    if recurring:
        parts.append(f"You kept returning to {', '.join(recurring[:3])}.")
    if new_artists:
        parts.append(f"New anchors entered the field: {', '.join(new_artists[:3])}.")
    if genre_migration:
        parts.append(f"The genre map shifted through {', '.join(genre_migration[:3])}.")
    if not parts:
        return "Your Spotify identity stayed stable across the stored snapshots; the same artists, genres, and audio-features remain the strongest evidence."
    return " ".join(parts)


def list_stored_snapshots(user_id: str) -> list[dict]:
    snapshots = list_identity_snapshots(user_id)
    return [item.get("payload", item) for item in snapshots]

from __future__ import annotations

from collections import Counter

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
        "archetype_scores": {item.get("label"): item.get("pct", item.get("score", 0)) for item in personality if isinstance(item, dict) and item.get("label")},
        "mbti": mbti,
        "top_artists": [item.get("name") if isinstance(item, dict) else str(item) for item in top_artists[:10]],
        "top_genres": [item.get("genre") if isinstance(item, dict) else str(item) for item in genres[:10]],
        "audio_averages": audio,
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
        return {
            "archetypeChange": "Soft signal",
            "mbtiAxisShift": "Soft signal",
            "genreMovement": [],
            "energyValenceMovement": {"energyDelta": 0.0, "valenceDelta": 0.0},
            "newArtists": [],
            "recurringArtists": ordered[0].get("top_artists", []) if ordered else [],
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
    first_genres = first.get("top_genres", [])
    last_genres = last.get("top_genres", [])
    first_audio = first.get("audio_averages", {})
    last_audio = last.get("audio_averages", {})
    recurring = sorted(set(first.get("top_artists", [])) & set(last.get("top_artists", [])))
    new_artists = sorted(set(last.get("top_artists", [])) - set(first.get("top_artists", [])))
    departed_artists = sorted(set(first.get("top_artists", [])) - set(last.get("top_artists", [])))
    strongest_trait = max(archetype_change.items(), key=lambda item: abs(item[1]))[0] if archetype_change else "Soft signal"
    strongest_axis = max(mbti_shift.items(), key=lambda item: abs(item[1]))[0] if mbti_shift else "Soft signal"
    return {
        "archetypeChange": strongest_trait,
        "mbtiAxisShift": strongest_axis,
        "genreMovement": [genre for genre in last_genres if genre not in first_genres] or [genre for genre in first_genres if genre not in last_genres],
        "energyValenceMovement": {
            "energyDelta": round(float(last_audio.get("energy", 0)) - float(first_audio.get("energy", 0)), 3),
            "valenceDelta": round(float(last_audio.get("valence", 0)) - float(first_audio.get("valence", 0)), 3),
        },
        "newArtists": new_artists,
        "recurringArtists": recurring,
        "departedArtists": departed_artists,
        "raw": {
            "archetypeChange": archetype_change,
            "mbtiAxisShift": mbti_shift,
        },
    }


def list_stored_snapshots(user_id: str) -> list[dict]:
    snapshots = list_identity_snapshots(user_id)
    return [item.get("payload", item) for item in snapshots]

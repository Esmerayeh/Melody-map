from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import math
from typing import Any


IDENTITY_SIGNAL_SCHEMA_VERSION = "2026-05-spotify-identity-v1"
MUSIC_IDENTITY_SCHEMA_VERSION = "2026-05-sonic-field-v1"

ATMOSPHERIC_GENRE_TERMS = (
    "ambient",
    "dream pop",
    "shoegaze",
    "slowcore",
    "post-rock",
    "lo-fi",
    "chillwave",
    "drone",
)
MELANCHOLY_GENRE_TERMS = (
    "sadcore",
    "slowcore",
    "emo",
    "darkwave",
    "goth",
    "indie folk",
    "singer-songwriter",
    "shoegaze",
)
CINEMATIC_GENRE_TERMS = (
    "post-rock",
    "ambient",
    "classical",
    "soundtrack",
    "instrumental",
    "drone",
    "experimental",
)
RHYTHM_GENRE_TERMS = (
    "house",
    "techno",
    "dance",
    "edm",
    "disco",
    "funk",
    "drum and bass",
    "afrobeats",
)

SIGNAL_TO_TRAIT = {
    "dreamy": ("atmosphere_preference", "cinematic_preference"),
    "nostalgic": ("nostalgia_intensity", "comfort_listening"),
    "chaotic": ("rhythm_affinity", "emotional_volatility"),
    "romantic": ("emotional_depth", "comfort_listening"),
    "melancholic": ("melancholy_tendency", "emotional_depth"),
    "cosmic": ("cinematic_preference", "atmosphere_preference"),
}

SIGNAL_COLORS = {
    "atmosphere_preference": "#a78bfa",
    "melancholy_tendency": "#60a5fa",
    "nostalgia_intensity": "#fbbf24",
    "exploration_tendency": "#34d399",
    "comfort_listening": "#f472b6",
    "nighttime_emotionality": "#818cf8",
    "rhythm_affinity": "#fb7185",
    "sonic_curiosity": "#22d3ee",
    "lyrical_focus": "#c084fc",
    "cinematic_preference": "#93c5fd",
    "emotional_depth": "#f0abfc",
    "emotional_volatility": "#f97316",
}

SIGNAL_ICONS = {
    "atmosphere_preference": "mist",
    "melancholy_tendency": "moon",
    "nostalgia_intensity": "film",
    "exploration_tendency": "compass",
    "comfort_listening": "anchor",
    "nighttime_emotionality": "night",
    "rhythm_affinity": "pulse",
    "sonic_curiosity": "spark",
    "lyrical_focus": "voice",
    "cinematic_preference": "lens",
    "emotional_depth": "heart",
    "emotional_volatility": "wave",
}

SONIC_AXIS_DEFINITIONS = {
    "innerworld_outward_pulse": {
        "left": "Innerworld",
        "right": "Outward Pulse",
        "leftMeaning": "private, atmospheric, intimate listening",
        "rightMeaning": "social, kinetic, brighter listening",
    },
    "abstract_tangible": {
        "left": "Abstract",
        "right": "Tangible",
        "leftMeaning": "genre-fluid, exploratory, texture-led listening",
        "rightMeaning": "familiar, concrete, stable listening",
    },
    "immersion_architecture": {
        "left": "Immersion",
        "right": "Architecture",
        "leftMeaning": "emotion and atmosphere first",
        "rightMeaning": "structure, rhythm, and form first",
    },
    "ritual_drift": {
        "left": "Ritual",
        "right": "Drift",
        "leftMeaning": "returning to stable anchors",
        "rightMeaning": "wandering through changing sound worlds",
    },
}

MUSIC_IDENTITY_TYPES = {
    ("Innerworld", "Abstract", "Immersion", "Ritual"): {
        "name": "The Dream Archivist",
        "tagline": "You keep small weather systems inside songs.",
        "description": "Your taste gathers atmosphere, memory, and recurrence into a private archive. You return to certain artists like rooms you still remember the light in.",
        "strengths": ["emotional recall", "atmospheric sensitivity", "deep artist attachment"],
        "shadows": ["over-returning to familiar ache", "slow movement out of old moods"],
        "recommendationStyle": "Offer adjacent atmospheres that respect the memory core before widening the horizon.",
        "soulmateHint": "Best with listeners who understand repetition as devotion, not limitation.",
        "shareLine": "My music keeps little rooms of weather and memory.",
    },
    ("Innerworld", "Abstract", "Immersion", "Drift"): {
        "name": "The Velvet Wanderer",
        "tagline": "Your sound drifts softly, but it never feels empty.",
        "description": "You move through texture, shadow, and emotional haze, chasing songs that make the inner world feel larger without becoming loud.",
        "strengths": ["sonic curiosity", "emotional nuance", "gentle transformation"],
        "shadows": ["restless searching", "difficulty settling inside one era"],
        "recommendationStyle": "Bring strange, beautiful neighbors with close emotional temperature.",
        "soulmateHint": "Best with listeners who can wander without trying to explain the whole map.",
        "shareLine": "My music drifts through velvet, fog, and almost-memory.",
    },
    ("Innerworld", "Abstract", "Architecture", "Ritual"): {
        "name": "The Astral Curator",
        "tagline": "You build quiet systems for impossible feelings.",
        "description": "Your listening balances unusual taste with a need for shape. You trust texture, but you also notice the hidden architecture holding it together.",
        "strengths": ["curation", "pattern recognition", "taste precision"],
        "shadows": ["over-editing the emotional field", "guarded discovery"],
        "recommendationStyle": "Suggest detailed, well-built records with unusual surface textures.",
        "soulmateHint": "Best with listeners who hear structure without draining the magic from it.",
        "shareLine": "My music is a private constellation with precise gravity.",
    },
    ("Innerworld", "Abstract", "Architecture", "Drift"): {
        "name": "The Signal Alchemist",
        "tagline": "You turn strange sound into private meaning.",
        "description": "Your taste is exploratory and analytic without becoming cold. You seem to trust songs that leave room for interpretation and secret circuitry.",
        "strengths": ["experimental appetite", "subtle analysis", "genre translation"],
        "shadows": ["detachment when feeling becomes too direct", "chasing novelty for signal"],
        "recommendationStyle": "Give boundary-crossing tracks with visible sonic craft.",
        "soulmateHint": "Best with listeners who enjoy decoding feeling through sound design.",
        "shareLine": "My music turns static into signal.",
    },
    ("Innerworld", "Tangible", "Immersion", "Ritual"): {
        "name": "The Memory Diver",
        "tagline": "You return to songs like light under closed doors.",
        "description": "Your identity is built from familiar emotional anchors. You do not chase songs as much as revisit the ones that know where the feeling lives.",
        "strengths": ["loyalty", "emotional steadiness", "deep comfort listening"],
        "shadows": ["nostalgia loops", "reluctance to leave old rooms"],
        "recommendationStyle": "Surface rediscoveries, remasters, live versions, and close cousins of trusted artists.",
        "soulmateHint": "Best with listeners who share artist memories and long arcs.",
        "shareLine": "My music remembers for me.",
    },
    ("Innerworld", "Tangible", "Immersion", "Drift"): {
        "name": "The Nocturne Seeker",
        "tagline": "Your playlists choose candlelight over neon.",
        "description": "You carry a familiar emotional center, but your recent listening keeps moving around it, softening and darkening as the signal changes.",
        "strengths": ["intimacy", "late-night sensitivity", "quiet exploration"],
        "shadows": ["mood-dependence", "disappearing into softer corners"],
        "recommendationStyle": "Offer gentle expansions from known anchors into darker or softer rooms.",
        "soulmateHint": "Best with listeners who understand night listening as a real language.",
        "shareLine": "My music walks through rooms with the lights low.",
    },
    ("Innerworld", "Tangible", "Architecture", "Ritual"): {
        "name": "The Liminal Collector",
        "tagline": "You make order from the songs that keep returning.",
        "description": "Your taste has a stable center and a careful sense of form. The same artists can return because they still solve something for you.",
        "strengths": ["consistency", "discernment", "ritual listening"],
        "shadows": ["narrow comfort zones", "over-trusting proven formulas"],
        "recommendationStyle": "Use small controlled variations around core artists and tempos.",
        "soulmateHint": "Best with listeners whose libraries have memory and discipline.",
        "shareLine": "My music is a ritual with a soft edge.",
    },
    ("Innerworld", "Tangible", "Architecture", "Drift"): {
        "name": "The Glasshearted Voyager",
        "tagline": "You move carefully, but the feeling still moves.",
        "description": "Your listening keeps recognizable anchors while testing new shapes. It is not chaos; it is a measured voyage away from the familiar.",
        "strengths": ["taste continuity", "measured curiosity", "emotional control"],
        "shadows": ["hesitation at the edge of discovery", "over-filtering surprise"],
        "recommendationStyle": "Blend trusted genre centers with one or two clean structural departures.",
        "soulmateHint": "Best with listeners who can stretch without breaking the atmosphere.",
        "shareLine": "My music travels with a lantern.",
    },
    ("Outward Pulse", "Abstract", "Immersion", "Ritual"): {
        "name": "The Fever Bloom",
        "tagline": "Your music turns intensity into color.",
        "description": "You return to vivid emotional anchors, but the surface stays alive and expressive. Your familiar songs do not sit still; they glow louder each time.",
        "strengths": ["expressiveness", "emotional charge", "magnetic taste"],
        "shadows": ["intensity loops", "mistaking volume for release"],
        "recommendationStyle": "Bring emotionally saturated tracks that keep a clear recurring center.",
        "soulmateHint": "Best with listeners who can meet intensity without flattening it.",
        "shareLine": "My music blooms hot, bright, and remembered.",
    },
    ("Outward Pulse", "Abstract", "Immersion", "Drift"): {
        "name": "The Soft Chaos Listener",
        "tagline": "You chase feeling before it has a name.",
        "description": "Your taste is alive with motion, genre fluidity, and emotional weather. You seem pulled toward songs that change the room quickly.",
        "strengths": ["adaptive feeling", "wide discovery", "emotional range"],
        "shadows": ["scatter", "overstimulation", "unfinished eras"],
        "recommendationStyle": "Recommend vivid discoveries grouped by emotional temperature so the motion still feels curated.",
        "soulmateHint": "Best with listeners who enjoy change without needing to pin it down.",
        "shareLine": "My music is soft chaos with a pulse.",
    },
    ("Outward Pulse", "Abstract", "Architecture", "Ritual"): {
        "name": "The Neon Pilgrim",
        "tagline": "You return to momentum like a sacred route.",
        "description": "Your identity loves energy and unusual shape, but it still forms rituals. You revisit motion, rhythm, and bright structures as if they are landmarks.",
        "strengths": ["momentum", "bold curation", "rhythmic memory"],
        "shadows": ["restless repetition", "performative listening pressure"],
        "recommendationStyle": "Use energetic tracks with interesting structure and familiar rhythmic gravity.",
        "soulmateHint": "Best with listeners who can share movement and keep pace.",
        "shareLine": "My music follows neon roads back to itself.",
    },
    ("Outward Pulse", "Abstract", "Architecture", "Drift"): {
        "name": "The Sonic Oracle",
        "tagline": "You read the future through rhythm and surprise.",
        "description": "Your listening is mobile, curious, and structurally alert. You look for songs that shift the rules while still giving the body something to follow.",
        "strengths": ["discovery instinct", "rhythmic intelligence", "future-facing taste"],
        "shadows": ["novelty hunger", "leaving songs before they become memory"],
        "recommendationStyle": "Push new scenes, hybrid genres, and high-signal outliers.",
        "soulmateHint": "Best with listeners whose taste is also in motion.",
        "shareLine": "My music keeps finding doors in the beat.",
    },
    ("Outward Pulse", "Tangible", "Immersion", "Ritual"): {
        "name": "The Static Romantic",
        "tagline": "You build little shrines out of repetition.",
        "description": "Your taste is emotionally direct, recognizable, and loyal. You come back to songs because the feeling remains useful, not because the algorithm insists.",
        "strengths": ["warmth", "emotional loyalty", "shareable feeling"],
        "shadows": ["sentimental loops", "over-familiar emotional scripts"],
        "recommendationStyle": "Recommend emotionally clear songs with shared artist or genre lineage.",
        "soulmateHint": "Best with listeners who value shared favorites and honest feeling.",
        "shareLine": "My music repeats until it glows.",
    },
    ("Outward Pulse", "Tangible", "Immersion", "Drift"): {
        "name": "The Moonlit Cartographer",
        "tagline": "You map feeling through familiar stars.",
        "description": "Your listening is approachable and emotional, but the map keeps changing. You drift through recognizable worlds while tracking new shades of feeling.",
        "strengths": ["emotional navigation", "social warmth", "taste movement"],
        "shadows": ["mood chasing", "unclear destination"],
        "recommendationStyle": "Offer clear emotional hooks with enough novelty to mark a new route.",
        "soulmateHint": "Best with listeners who can share the map without owning it.",
        "shareLine": "My music maps the night in familiar stars.",
    },
    ("Outward Pulse", "Tangible", "Architecture", "Ritual"): {
        "name": "The Cathedral Drifter",
        "tagline": "You make big feelings feel built to last.",
        "description": "Your identity favors recognizable structures, strong recurrence, and music that can hold a room. The feeling is real, but it wants a frame.",
        "strengths": ["clarity", "shared energy", "structured devotion"],
        "shadows": ["rigid taste loops", "leaning too hard on proven anchors"],
        "recommendationStyle": "Use confident, well-structured tracks near known genre centers.",
        "soulmateHint": "Best with listeners who appreciate both feeling and form.",
        "shareLine": "My music gives emotion a cathedral.",
    },
    ("Outward Pulse", "Tangible", "Architecture", "Drift"): {
        "name": "The Echo Mystic",
        "tagline": "You follow familiar echoes into new rooms.",
        "description": "Your taste keeps a clear shape while moving forward. You like songs that are legible enough to enter quickly, then strange enough to keep unfolding.",
        "strengths": ["adaptability", "clean discovery", "social readability"],
        "shadows": ["surface-level novelty", "moving on before depth arrives"],
        "recommendationStyle": "Recommend accessible discoveries with strong hooks and subtle atmosphere.",
        "soulmateHint": "Best with listeners who can make discovery feel easy.",
        "shareLine": "My music follows echoes into new light.",
    },
}


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if isinstance(value, bool):
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _clamp01(value: float | None) -> float | None:
    if value is None:
        return None
    return max(0.0, min(1.0, value))


def _score100(value: float | None) -> int:
    return int(round((_clamp01(value) or 0.0) * 100))


def _label_from_item(item: Any, *keys: str) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for key in keys:
            value = item.get(key)
            if value:
                return str(value).strip()
    return ""


def _artist_names(artists: list[Any], limit: int = 6) -> list[str]:
    names: list[str] = []
    for artist in artists or []:
        name = _label_from_item(artist, "name", "artist")
        if name and name not in names:
            names.append(name)
        if len(names) >= limit:
            break
    return names


def _genre_labels(genres: list[Any], limit: int = 10) -> list[str]:
    labels: list[str] = []
    for genre in genres or []:
        label = _label_from_item(genre, "genre", "name")
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= limit:
            break
    return labels


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
    if title and artist:
        return f"{title} by {artist}"
    return title or artist


def _track_key(track: Any) -> str:
    if not isinstance(track, dict):
        return str(track or "").strip().lower()
    raw = track.get("id") or track.get("spotify_id")
    if raw:
        return str(raw)
    return _track_label(track).lower()


def _audio_value(audio: dict, key: str) -> float | None:
    value = _safe_float((audio or {}).get(key))
    if key == "tempo" and value is not None:
        return _clamp01(value / 200.0)
    return _clamp01(value)


def _audio_values(rows: list[dict], key: str) -> list[float]:
    values: list[float] = []
    for row in rows or []:
        value = _audio_value(row, key)
        if value is not None:
            values.append(value)
    return values


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _std(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    avg = _mean(values) or 0.0
    return math.sqrt(sum((value - avg) ** 2 for value in values) / len(values))


def _variance(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    avg = _mean(values) or 0.0
    return sum((value - avg) ** 2 for value in values) / len(values)


def _normalized_entropy(labels: list[str]) -> float | None:
    clean = [str(label).lower().strip() for label in labels or [] if str(label).strip()]
    if not clean:
        return None
    counts = Counter(clean)
    total = sum(counts.values()) or 1
    if len(counts) == 1:
        return 0.0
    entropy = -sum((count / total) * math.log(count / total) for count in counts.values())
    return _clamp01(entropy / math.log(len(counts)))


def _mean_optional(*values: float | None) -> float | None:
    present = [value for value in values if value is not None]
    return _mean(present) if present else None


def _weighted(parts: list[tuple[float | None, float]]) -> float | None:
    present = [(value, weight) for value, weight in parts if value is not None and weight > 0]
    if not present:
        return None
    weight_sum = sum(weight for _, weight in present) or 1.0
    return sum((value or 0.0) * weight for value, weight in present) / weight_sum


def _release_year(track: Any) -> int | None:
    if not isinstance(track, dict):
        return None
    release = str(track.get("release_date") or "")
    if len(release) < 4 or not release[:4].isdigit():
        return None
    return int(release[:4])


def _genre_hits(genres: list[str], terms: tuple[str, ...]) -> list[str]:
    hits: list[str] = []
    for genre in genres:
        lowered = genre.lower()
        if any(term in lowered for term in terms):
            hits.append(genre)
    return hits


def _genre_hit_score(genres: list[str], terms: tuple[str, ...]) -> float | None:
    if not genres:
        return None
    hits = _genre_hits(genres, terms)
    return min(1.0, len(hits) / min(5, max(len(genres), 1)))


def _artist_genre_hits(artists: list[dict], terms: tuple[str, ...], limit: int = 5) -> list[str]:
    matches: list[str] = []
    for artist in artists or []:
        genres = artist.get("genres") if isinstance(artist, dict) else []
        joined = " ".join(str(item).lower() for item in genres or [])
        if joined and any(term in joined for term in terms):
            name = _label_from_item(artist, "name", "artist")
            if name:
                matches.append(name)
        if len(matches) >= limit:
            break
    return matches


def _parse_hour(value: str | None) -> int | None:
    if not value:
        return None
    raw = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.hour
    except ValueError:
        return None


def _time_window_stats(recent_tracks: list[dict]) -> dict:
    hours = []
    for track in recent_tracks or []:
        if not isinstance(track, dict):
            continue
        hour = _parse_hour(track.get("played_at") or track.get("playedAt"))
        if hour is not None:
            hours.append(hour)
    night_hours = [hour for hour in hours if hour >= 21 or hour < 5]
    day_hours = [hour for hour in hours if 8 <= hour < 18]
    return {
        "sampleSize": len(hours),
        "nightCount": len(night_hours),
        "dayCount": len(day_hours),
        "nightShare": round(len(night_hours) / len(hours), 3) if hours else None,
    }


def _repeat_context(top_tracks: list[dict], recent_tracks: list[dict], saved_tracks: list[dict]) -> dict:
    top_keys = {_track_key(track) for track in top_tracks or [] if _track_key(track)}
    recent_keys = {_track_key(track) for track in recent_tracks or [] if _track_key(track)}
    saved_keys = {_track_key(track) for track in saved_tracks or [] if _track_key(track)}
    overlaps = (top_keys & recent_keys) | (top_keys & saved_keys) | (recent_keys & saved_keys)

    artist_counter: Counter[str] = Counter()
    for track in [*(top_tracks or []), *(recent_tracks or []), *(saved_tracks or [])]:
        artist = _label_from_item(track, "artist")
        if artist:
            artist_counter[artist] += 1

    repeated_artists = [name for name, count in artist_counter.most_common(8) if count >= 2]
    overlap_labels = []
    for track in [*(top_tracks or []), *(recent_tracks or []), *(saved_tracks or [])]:
        key = _track_key(track)
        label = _track_label(track)
        if key in overlaps and label and label not in overlap_labels:
            overlap_labels.append(label)
        if len(overlap_labels) >= 5:
            break

    total_known = max(len(top_keys | recent_keys | saved_keys), 1)
    return {
        "trackOverlapCount": len(overlaps),
        "trackOverlapShare": round(len(overlaps) / total_known, 3),
        "trackOverlaps": overlap_labels,
        "recurringArtists": repeated_artists,
    }


def _top_obscure_artists(artists: list[dict], limit: int = 4) -> list[str]:
    rows = []
    for artist in artists or []:
        popularity = _safe_float(artist.get("popularity")) if isinstance(artist, dict) else None
        name = _label_from_item(artist, "name", "artist")
        if name and popularity is not None:
            rows.append((popularity, name))
    rows.sort(key=lambda item: item[0])
    return [name for popularity, name in rows[:limit] if popularity < 55]


def _feature_receipt(label: str, value: float | None, sample_size: int | None = None) -> str | None:
    if value is None:
        return None
    suffix = f" across {sample_size} Spotify audio-featured top tracks" if sample_size else ""
    return f"{label} is {_score100(value)}%{suffix}"


def _make_signal(
    signals: list[dict],
    *,
    signal_id: str,
    label: str,
    score: float | None,
    confidence: float,
    evidence: list[str | None],
    method: str,
    spotify_fields: list[str],
    available: bool = True,
) -> None:
    clean_evidence = [item for item in evidence if item]
    if not available:
        signals.append(
            {
                "id": signal_id,
                "label": label,
                "score": None,
                "pct": None,
                "confidence": 0.0,
                "available": False,
                "evidence": clean_evidence,
                "method": method,
                "spotifyFields": spotify_fields,
                "color": SIGNAL_COLORS.get(signal_id, "#a78bfa"),
                "icon": SIGNAL_ICONS.get(signal_id, "spark"),
            }
        )
        return
    if score is None or not clean_evidence:
        return
    normalized = _clamp01(score) or 0.0
    signals.append(
        {
            "id": signal_id,
            "label": label,
            "score": round(normalized, 3),
            "pct": _score100(normalized),
            "confidence": round(_clamp01(confidence) or 0.0, 3),
            "available": True,
            "evidence": clean_evidence[:4],
            "method": method,
            "spotifyFields": spotify_fields,
            "color": SIGNAL_COLORS.get(signal_id, "#a78bfa"),
            "icon": SIGNAL_ICONS.get(signal_id, "spark"),
        }
    )


def _metric(
    *,
    metric_id: str,
    label: str,
    score: float | None,
    confidence: float,
    evidence: list[str | None],
    method: str,
    spotify_fields: list[str],
    available: bool = True,
) -> dict:
    clean_evidence = [item for item in evidence if item]
    if score is None or not available:
        return {
            "id": metric_id,
            "label": label,
            "score": None,
            "pct": None,
            "confidence": 0.0,
            "available": False,
            "evidence": clean_evidence or ["More Spotify history is needed before this metric can be read."],
            "method": method,
            "spotifyFields": spotify_fields,
        }
    normalized = _clamp01(score) or 0.0
    return {
        "id": metric_id,
        "label": label,
        "score": round(normalized, 3),
        "pct": _score100(normalized),
        "confidence": round(_clamp01(confidence) or 0.0, 3),
        "available": True,
        "evidence": clean_evidence[:4],
        "method": method,
        "spotifyFields": spotify_fields,
    }


def _axis_result(
    *,
    axis_id: str,
    score_left: float | None,
    confidence: float,
    evidence_left: list[str | None],
    evidence_right: list[str | None],
    method: str,
    spotify_fields: list[str],
) -> dict:
    definition = SONIC_AXIS_DEFINITIONS[axis_id]
    if score_left is None:
        return {
            "id": axis_id,
            **definition,
            "direction": "Still forming",
            "score": None,
            "balance": None,
            "confidence": 0.0,
            "evidence": ["More Spotify data is needed before this sonic axis can be read."],
            "method": method,
            "spotifyFields": spotify_fields,
        }
    normalized = _clamp01(score_left) or 0.0
    leans_left = normalized >= 0.5
    direction = definition["left"] if leans_left else definition["right"]
    evidence = evidence_left if leans_left else evidence_right
    return {
        "id": axis_id,
        **definition,
        "direction": direction,
        "score": _score100(max(normalized, 1 - normalized)),
        "balance": round((normalized - 0.5) * 2, 3),
        "rawLeftScore": round(normalized, 3),
        "confidence": round(_clamp01(confidence) or 0.0, 3),
        "evidence": [item for item in evidence if item][:4],
        "method": method,
        "spotifyFields": spotify_fields,
    }


def _first_available(metrics: list[dict], *metric_ids: str) -> list[dict]:
    wanted = set(metric_ids)
    return [metric for metric in metrics if metric.get("id") in wanted and metric.get("available")]


def _build_sonic_field_model(
    *,
    top_artists: list[dict],
    top_tracks: list[dict],
    recently_played: list[dict],
    saved_tracks: list[dict],
    audio_features: dict,
    audio_features_list: list[dict],
    analytics: dict,
    genre_labels: list[str],
    artist_names: list[str],
    track_names: list[str],
    repeat: dict,
    time_windows: dict,
    atmosphere_score: float | None,
    melancholy_score: float | None,
    nostalgia_score: float | None,
    exploration_score: float | None,
    comfort_score: float | None,
    rhythm_score: float | None,
    sonic_curiosity_score: float | None,
    cinematic_score: float | None,
    emotional_depth_score: float | None,
    volatility: float | None,
    atmosphere_genres: list[str],
    melancholy_genres: list[str],
    data_quality: dict,
) -> dict:
    feature_sample = len(audio_features_list or [])
    energy = _audio_value(audio_features, "energy")
    valence = _audio_value(audio_features, "valence")
    danceability = _audio_value(audio_features, "danceability")
    acousticness = _audio_value(audio_features, "acousticness")
    instrumentalness = _audio_value(audio_features, "instrumentalness")
    speechiness = _audio_value(audio_features, "speechiness")
    tempo = _audio_value(audio_features, "tempo")

    popularity_values = [
        _safe_float(artist.get("popularity")) / 100.0
        for artist in top_artists or []
        if isinstance(artist, dict) and _safe_float(artist.get("popularity")) is not None
    ]
    avg_popularity = _mean(popularity_values)
    popularity_deviation = _mean([abs(value - 0.62) for value in popularity_values]) if popularity_values else None
    genre_entropy = _normalized_entropy(genre_labels)
    artist_diversity = _clamp01(len({name.lower() for name in artist_names}) / 20.0) if artist_names else None
    older_tracks = [_track_label(track) for track in top_tracks if (_release_year(track) or 3000) <= datetime.now(timezone.utc).year - 7]
    older_track_share = len(older_tracks) / len(top_tracks) if top_tracks else None
    energy_values = _audio_values(audio_features_list, "energy")
    valence_values = _audio_values(audio_features_list, "valence")
    dance_values = _audio_values(audio_features_list, "danceability")
    tempo_values = _audio_values(audio_features_list, "tempo")
    energy_smoothness = (1 - min(1.0, (_std(energy_values) or 0.0) * 3.0)) if len(energy_values) >= 2 else None
    rhythm_consistency = (1 - min(1.0, (_std(tempo_values + dance_values) or 0.0) * 3.0)) if len(tempo_values + dance_values) >= 2 else None
    recurrence_mass = _clamp01(_mean_optional(repeat.get("trackOverlapShare"), min(1.0, len(repeat.get("recurringArtists") or []) / 8.0)))
    novelty_velocity = _clamp01(_mean_optional(exploration_score, volatility, popularity_deviation))
    drift_velocity = _clamp01(_mean_optional(volatility, exploration_score, (1 - recurrence_mass) if recurrence_mass is not None else None))
    harmonic_tension = _clamp01(_mean_optional(_std(valence_values), _std(energy_values), popularity_deviation))

    metrics = [
        _metric(
            metric_id="emotional_gravity",
            label="Emotional gravity",
            score=_weighted([
                ((1 - valence) if valence is not None else None, 0.34),
                (acousticness, 0.22),
                (instrumentalness, 0.14),
                (recurrence_mass, 0.18),
                (melancholy_score, 0.12),
            ]),
            confidence=min(1.0, (feature_sample / 40.0) * 0.74 + (0.26 if recurrence_mass is not None else 0.0)),
            evidence=[
                _feature_receipt("Low-valence pull", (1 - valence) if valence is not None else None, feature_sample),
                _feature_receipt("Acoustic texture", acousticness, feature_sample),
                f"Recurring anchors include {', '.join(repeat.get('recurringArtists', [])[:4])}" if repeat.get("recurringArtists") else None,
                f"Melancholy genre anchors include {', '.join(melancholy_genres[:4])}" if melancholy_genres else None,
            ],
            method="weighted mean(inverse valence, acousticness, instrumentalness, recurrence mass, melancholy genre pull)",
            spotify_fields=["audioFeatures.valence", "audioFeatures.acousticness", "audioFeatures.instrumentalness", "topTracks", "recentlyPlayed", "savedTracks"],
        ),
        _metric(
            metric_id="atmospheric_density",
            label="Atmospheric density",
            score=_weighted([
                (acousticness, 0.26),
                (instrumentalness, 0.24),
                (energy_smoothness, 0.16),
                (atmosphere_score, 0.24),
                (cinematic_score, 0.10),
            ]),
            confidence=min(1.0, (feature_sample / 40.0) * 0.7 + (0.3 if atmosphere_genres else 0.0)),
            evidence=[
                _feature_receipt("Acousticness", acousticness, feature_sample),
                _feature_receipt("Instrumentalness", instrumentalness, feature_sample),
                f"Atmospheric genre anchors include {', '.join(atmosphere_genres[:4])}" if atmosphere_genres else None,
            ],
            method="weighted mean(acousticness, instrumentalness, energy smoothness, atmospheric genre pull, cinematic pull)",
            spotify_fields=["audioFeatures.acousticness", "audioFeatures.instrumentalness", "audioFeatures.energy", "topArtists.genres"],
        ),
        _metric(
            metric_id="sonic_curiosity",
            label="Sonic curiosity",
            score=_weighted([
                (genre_entropy, 0.28),
                (artist_diversity, 0.20),
                (popularity_deviation, 0.18),
                (sonic_curiosity_score, 0.22),
                (exploration_score, 0.12),
            ]),
            confidence=min(1.0, (len(genre_labels) / 12.0) * 0.45 + (len(popularity_values) / 30.0) * 0.35 + (feature_sample / 50.0) * 0.20),
            evidence=[
                f"Genre entropy is {_score100(genre_entropy)}% across {len(genre_labels)} Spotify genre anchors" if genre_entropy is not None else None,
                f"Top-artist popularity deviation is {_score100(popularity_deviation)}%" if popularity_deviation is not None else None,
                f"Genre anchors include {', '.join(genre_labels[:5])}" if genre_labels else None,
            ],
            method="weighted mean(genre entropy, artist diversity, popularity deviation, instrumental/genre curiosity, exploration)",
            spotify_fields=["topArtists.genres", "topArtists.popularity", "audioFeatures.instrumentalness"],
        ),
        _metric(
            metric_id="comfort_orbit",
            label="Comfort orbit",
            score=recurrence_mass,
            confidence=min(1.0, (len(top_tracks) + len(recently_played) + len(saved_tracks)) / 90.0),
            evidence=[
                f"{repeat.get('trackOverlapCount', 0)} tracks repeat across Spotify top, recent, or saved windows" if repeat.get("trackOverlapCount") else None,
                f"Recurring artists include {', '.join(repeat.get('recurringArtists', [])[:5])}" if repeat.get("recurringArtists") else None,
            ],
            method="track overlap share plus recurring artist mass",
            spotify_fields=["topTracks", "recentlyPlayed", "savedTracks"],
        ),
        _metric(
            metric_id="nocturnal_signal",
            label="Nocturnal signal",
            score=time_windows.get("nightShare"),
            confidence=min(1.0, (time_windows.get("sampleSize") or 0) / 40.0),
            evidence=[
                f"{time_windows.get('nightCount')} of {time_windows.get('sampleSize')} timestamped recent plays landed late at night" if time_windows.get("sampleSize") else None,
            ],
            method="late-night share of recentlyPlayed.played_at timestamps",
            spotify_fields=["recentlyPlayed.played_at"],
            available=bool(time_windows.get("sampleSize")),
        ),
        _metric(
            metric_id="nostalgia_index",
            label="Nostalgia index",
            score=_mean_optional(nostalgia_score, older_track_share, recurrence_mass),
            confidence=min(1.0, ((analytics.get("sampleSizes") or {}).get("nostalgiaIndex", 0) / max(len(top_tracks), 1)) + (0.25 if recurrence_mass is not None else 0.0)) if top_tracks else 0.0,
            evidence=[
                f"Nostalgia index is {analytics.get('nostalgiaIndex')}% from top-track release years" if analytics.get("nostalgiaIndex") is not None else None,
                f"Older track anchors include {', '.join(older_tracks[:4])}" if older_tracks else None,
                f"Repeated track overlaps include {', '.join(repeat.get('trackOverlaps', [])[:3])}" if repeat.get("trackOverlaps") else None,
            ],
            method="mean(release-age nostalgia score, older track share, recurrence mass)",
            spotify_fields=["topTracks.release_date", "topTracks", "recentlyPlayed", "savedTracks"],
        ),
        _metric(
            metric_id="drift_velocity",
            label="Drift velocity",
            score=drift_velocity,
            confidence=min(0.72, (feature_sample / 50.0) * 0.34 + (len(genre_labels) / 12.0) * 0.24 + (0.14 if recurrence_mass is not None else 0.0)),
            evidence=[
                f"Feature variance is {_score100(volatility)}% across Spotify top tracks" if volatility is not None else None,
                f"Exploration pull is {_score100(exploration_score)}%" if exploration_score is not None else None,
                "Longitudinal snapshots will make this a true temporal drift vector; current value is a Spotify variance and novelty proxy.",
            ],
            method="proxy mean(feature variance, exploration pull, inverse recurrence mass) until multiple snapshots exist",
            spotify_fields=["audioFeaturesList.energy", "audioFeaturesList.valence", "audioFeaturesList.danceability", "topArtists.genres", "topArtists.popularity"],
        ),
        _metric(
            metric_id="liminality",
            label="Liminality",
            score=_mean_optional(volatility, genre_entropy, diversity := _clamp01((_safe_float(analytics.get("diversityScore")) or 0) / 100.0 if analytics.get("diversityScore") is not None else None)),
            confidence=min(1.0, (feature_sample / 45.0) * 0.5 + (len(genre_labels) / 12.0) * 0.5),
            evidence=[
                f"Valence and energy variance creates {_score100(volatility)}% emotional spread" if volatility is not None else None,
                f"Genre entropy is {_score100(genre_entropy)}%" if genre_entropy is not None else None,
                f"Genre anchors cross {', '.join(genre_labels[:5])}" if genre_labels else None,
            ],
            method="mean(audio feature spread, genre entropy, diversity score)",
            spotify_fields=["audioFeaturesList.energy", "audioFeaturesList.valence", "topArtists.genres", "analyticsMetrics.diversityScore"],
        ),
        _metric(
            metric_id="pulse_signature",
            label="Pulse signature",
            score=_weighted([
                (danceability, 0.32),
                (tempo, 0.26),
                (energy, 0.22),
                (rhythm_consistency, 0.20),
            ]),
            confidence=min(1.0, feature_sample / 40.0),
            evidence=[
                _feature_receipt("Danceability", danceability, feature_sample),
                _feature_receipt("Tempo pressure", tempo, feature_sample),
                _feature_receipt("Energy", energy, feature_sample),
            ],
            method="weighted mean(danceability, normalized tempo, energy, rhythm consistency)",
            spotify_fields=["audioFeatures.danceability", "audioFeatures.tempo", "audioFeatures.energy", "audioFeaturesList"],
        ),
        _metric(
            metric_id="shadow_frequency",
            label="Shadow frequency",
            score=_weighted([
                ((1 - valence) if valence is not None else None, 0.34),
                (acousticness, 0.20),
                (instrumentalness, 0.14),
                (melancholy_score, 0.22),
                (recurrence_mass, 0.10),
            ]),
            confidence=min(1.0, (feature_sample / 40.0) * 0.72 + (0.28 if melancholy_genres else 0.0)),
            evidence=[
                _feature_receipt("Low-valence undertone", (1 - valence) if valence is not None else None, feature_sample),
                f"Melancholy anchors include {', '.join(melancholy_genres[:4])}" if melancholy_genres else None,
                f"Repeated emotional anchors include {', '.join(repeat.get('recurringArtists', [])[:4])}" if repeat.get("recurringArtists") else None,
            ],
            method="weighted mean(inverse valence, acousticness, instrumentalness, melancholy pull, recurrence mass)",
            spotify_fields=["audioFeatures.valence", "audioFeatures.acousticness", "audioFeatures.instrumentalness", "topArtists.genres", "topTracks"],
        ),
    ]

    metric_by_id = {metric["id"]: metric for metric in metrics}
    emotional_gravity = metric_by_id["emotional_gravity"].get("score")
    atmospheric_density = metric_by_id["atmospheric_density"].get("score")
    curiosity = metric_by_id["sonic_curiosity"].get("score")
    comfort_orbit = metric_by_id["comfort_orbit"].get("score")
    pulse_signature = metric_by_id["pulse_signature"].get("score")
    liminality = metric_by_id["liminality"].get("score")
    shadow = metric_by_id["shadow_frequency"].get("score")
    drift = metric_by_id["drift_velocity"].get("score")

    innerworld_score = _weighted([
        (acousticness, 0.22),
        ((1 - danceability) if danceability is not None else None, 0.18),
        (instrumentalness, 0.16),
        ((1 - avg_popularity) if avg_popularity is not None else None, 0.14),
        (comfort_orbit, 0.18),
        (atmospheric_density, 0.12),
    ])
    abstract_score = _weighted([
        (genre_entropy, 0.25),
        (instrumentalness, 0.20),
        (popularity_deviation, 0.16),
        (volatility, 0.18),
        (curiosity, 0.21),
    ])
    immersion_score = _weighted([
        (volatility, 0.22),
        (atmospheric_density, 0.24),
        (emotional_gravity, 0.24),
        (shadow, 0.14),
        (comfort_orbit, 0.16),
    ])
    ritual_score = _weighted([
        (comfort_orbit, 0.38),
        ((1 - drift) if drift is not None else None, 0.24),
        (recurrence_mass, 0.24),
        ((1 - novelty_velocity) if novelty_velocity is not None else None, 0.14),
    ])

    axes = [
        _axis_result(
            axis_id="innerworld_outward_pulse",
            score_left=innerworld_score,
            confidence=min(1.0, (feature_sample / 45.0) * 0.55 + (len(popularity_values) / 30.0) * 0.25 + (0.2 if recurrence_mass is not None else 0.0)),
            evidence_left=[
                _feature_receipt("Acousticness", acousticness, feature_sample),
                _feature_receipt("Inverse danceability", (1 - danceability) if danceability is not None else None, feature_sample),
                f"Recurring artists include {', '.join(repeat.get('recurringArtists', [])[:4])}" if repeat.get("recurringArtists") else None,
            ],
            evidence_right=[
                _feature_receipt("Energy", energy, feature_sample),
                _feature_receipt("Danceability", danceability, feature_sample),
                f"Average top-artist popularity is {_score100(avg_popularity)}%" if avg_popularity is not None else None,
            ],
            method="Innerworld = acousticness + inverse danceability + instrumentalness + inverse popularity + recurrence + atmosphere",
            spotify_fields=["audioFeatures", "topArtists.popularity", "topTracks", "recentlyPlayed", "savedTracks"],
        ),
        _axis_result(
            axis_id="abstract_tangible",
            score_left=abstract_score,
            confidence=min(1.0, (len(genre_labels) / 12.0) * 0.44 + (feature_sample / 45.0) * 0.36 + (len(popularity_values) / 30.0) * 0.2),
            evidence_left=[
                f"Genre entropy is {_score100(genre_entropy)}% across {len(genre_labels)} anchors" if genre_entropy is not None else None,
                _feature_receipt("Instrumentalness", instrumentalness, feature_sample),
                f"Popularity deviation is {_score100(popularity_deviation)}%" if popularity_deviation is not None else None,
            ],
            evidence_right=[
                f"Comfort orbit is {_score100(comfort_orbit)}%" if comfort_orbit is not None else None,
                f"Genre anchors stay close to {', '.join(genre_labels[:4])}" if genre_labels else None,
                f"Average artist popularity is {_score100(avg_popularity)}%" if avg_popularity is not None else None,
            ],
            method="Abstract = genre entropy + instrumentalness + popularity deviation + sonic variance + curiosity",
            spotify_fields=["topArtists.genres", "topArtists.popularity", "audioFeatures", "audioFeaturesList"],
        ),
        _axis_result(
            axis_id="immersion_architecture",
            score_left=immersion_score,
            confidence=min(1.0, (feature_sample / 45.0) * 0.68 + (0.32 if repeat.get("recurringArtists") else 0.0)),
            evidence_left=[
                f"Emotional gravity is {_score100(emotional_gravity)}%" if emotional_gravity is not None else None,
                f"Atmospheric density is {_score100(atmospheric_density)}%" if atmospheric_density is not None else None,
                f"Repeated emotional anchors include {', '.join(repeat.get('recurringArtists', [])[:4])}" if repeat.get("recurringArtists") else None,
            ],
            evidence_right=[
                f"Pulse signature is {_score100(pulse_signature)}%" if pulse_signature is not None else None,
                _feature_receipt("Speechiness", speechiness, feature_sample),
                f"Rhythm consistency is {_score100(rhythm_consistency)}%" if rhythm_consistency is not None else None,
            ],
            method="Immersion = emotional spread + atmosphere + gravity + shadow + replay anchors",
            spotify_fields=["audioFeatures", "audioFeaturesList", "topTracks", "recentlyPlayed", "savedTracks"],
        ),
        _axis_result(
            axis_id="ritual_drift",
            score_left=ritual_score,
            confidence=min(0.9, (len(top_tracks) + len(recently_played) + len(saved_tracks)) / 95.0),
            evidence_left=[
                f"Comfort orbit is {_score100(comfort_orbit)}%" if comfort_orbit is not None else None,
                f"Recurring artists include {', '.join(repeat.get('recurringArtists', [])[:4])}" if repeat.get("recurringArtists") else None,
                f"Repeated tracks include {', '.join(repeat.get('trackOverlaps', [])[:3])}" if repeat.get("trackOverlaps") else None,
            ],
            evidence_right=[
                f"Drift velocity is {_score100(drift)}%" if drift is not None else None,
                f"Sonic curiosity is {_score100(curiosity)}%" if curiosity is not None else None,
                f"Genre entropy is {_score100(genre_entropy)}%" if genre_entropy is not None else None,
            ],
            method="Ritual = comfort orbit + inverse drift velocity + recurrence mass + inverse novelty velocity",
            spotify_fields=["topTracks", "recentlyPlayed", "savedTracks", "topArtists.genres", "topArtists.popularity"],
        ),
    ]

    axis_directions = [axis["direction"] for axis in axes]
    if any(direction == "Still forming" for direction in axis_directions):
        type_meta = {
            "name": "Your identity is still forming",
            "tagline": "The field needs more Spotify signal before it can name itself.",
            "description": "Melody Map can show early traces, but it will not invent a full identity from weak data.",
            "strengths": ["early signal honesty"],
            "shadows": ["limited Spotify evidence"],
            "recommendationStyle": "Start with known artists and ask for more listening history before strong claims.",
            "soulmateHint": "Compatibility will become clearer after richer Spotify history arrives.",
            "shareLine": "My music identity is still forming.",
        }
        type_key = "forming"
    else:
        type_key_tuple = tuple(axis_directions)
        type_meta = MUSIC_IDENTITY_TYPES.get(type_key_tuple) or MUSIC_IDENTITY_TYPES[("Innerworld", "Abstract", "Immersion", "Ritual")]
        type_key = "|".join(type_key_tuple).lower().replace(" ", "_")

    available_metric_count = len([metric for metric in metrics if metric.get("available")])
    identity_confidence = _clamp01(_mean([axis.get("confidence", 0) for axis in axes] + [metric.get("confidence", 0) for metric in metrics if metric.get("available")]) or 0.0)
    low_data = feature_sample < 8 or len(top_artists) < 4 or len(genre_labels) < 2

    field_vector = {
        "energy": round(energy, 3) if energy is not None else None,
        "valence": round(valence, 3) if valence is not None else None,
        "danceability": round(danceability, 3) if danceability is not None else None,
        "acousticness": round(acousticness, 3) if acousticness is not None else None,
        "instrumentalness": round(instrumentalness, 3) if instrumentalness is not None else None,
        "speechiness": round(speechiness, 3) if speechiness is not None else None,
        "tempoNorm": round(tempo, 3) if tempo is not None else None,
        "popularityNorm": round(avg_popularity, 3) if avg_popularity is not None else None,
        "genreEntropy": round(genre_entropy, 3) if genre_entropy is not None else None,
        "recurrenceMass": round(recurrence_mass, 3) if recurrence_mass is not None else None,
        "temporalWeight": round(time_windows.get("nightShare"), 3) if time_windows.get("nightShare") is not None else None,
    }

    strongest_metrics = sorted(
        [metric for metric in metrics if metric.get("available")],
        key=lambda item: (item.get("score") or 0) * (item.get("confidence") or 0),
        reverse=True,
    )[:3]

    if low_data:
        line = "Your identity is still forming. Melody Map needs more Spotify listening history before it can make a precise reading without guessing."
    else:
        primary_metric = strongest_metrics[0]["label"].lower() if strongest_metrics else "listening gravity"
        top_artists_text = ", ".join(artist_names[:3]) if artist_names else "your artist anchors"
        line = f"Your music identity reads as {type_meta['name']} because {primary_metric} keeps recurring around Spotify anchors like {top_artists_text}."

    return {
        "schemaVersion": MUSIC_IDENTITY_SCHEMA_VERSION,
        "framework": "Sonic Field Model",
        "notDiagnosis": True,
        "type": {
            "id": type_key,
            "name": type_meta["name"],
            "tagline": type_meta["tagline"],
            "description": type_meta["description"],
            "strengths": type_meta["strengths"],
            "shadows": type_meta["shadows"],
            "recommendationStyle": type_meta["recommendationStyle"],
            "soulmateHint": type_meta["soulmateHint"],
            "shareLine": type_meta["shareLine"],
        },
        "identityName": type_meta["name"],
        "poeticLine": line,
        "axes": axes,
        "metrics": metrics,
        "topMetrics": strongest_metrics,
        "sonicField": {
            "vector": field_vector,
            "centroid": field_vector,
            "variance": {
                "energy": round(_variance(energy_values), 4) if _variance(energy_values) is not None else None,
                "valence": round(_variance(valence_values), 4) if _variance(valence_values) is not None else None,
                "danceability": round(_variance(dance_values), 4) if _variance(dance_values) is not None else None,
            },
            "entropy": {
                "genre": round(genre_entropy, 3) if genre_entropy is not None else None,
            },
            "recurrenceMass": round(recurrence_mass, 3) if recurrence_mass is not None else None,
            "noveltyVelocity": round(novelty_velocity, 3) if novelty_velocity is not None else None,
            "orbitStability": round(ritual_score, 3) if ritual_score is not None else None,
            "phaseShift": round(drift_velocity, 3) if drift_velocity is not None else None,
            "harmonicTension": round(harmonic_tension, 3) if harmonic_tension is not None else None,
            "methodology": "Each track and artist contributes a Spotify-derived sonic particle vector. Metrics use weighted centroids, variance, entropy, recurrence mass, and novelty proxies.",
        },
        "evidence": {
            "artistAnchors": artist_names[:8],
            "trackAnchors": track_names[:6],
            "genreAnchors": genre_labels[:10],
            "receipts": [
                f"Artist anchors used: {', '.join(artist_names[:5])}." if artist_names else None,
                f"Genre anchors used: {', '.join(genre_labels[:6])}." if genre_labels else None,
                f"Audio-feature sample size: {feature_sample} Spotify top tracks.",
                f"Recurrence mass comes from {repeat.get('trackOverlapCount', 0)} repeated track overlaps and {len(repeat.get('recurringArtists') or [])} recurring artists.",
            ],
        },
        "confidence": {
            "score": round(identity_confidence, 3),
            "label": "high" if identity_confidence >= 0.8 else "medium" if identity_confidence >= 0.5 else "low" if identity_confidence > 0 else "unavailable",
            "lowData": low_data,
            "availableMetricCount": available_metric_count,
            "missing": [
                "audioFeaturesList" if feature_sample < 8 else None,
                "topArtists" if len(top_artists) < 4 else None,
                "genres" if len(genre_labels) < 2 else None,
                "recentlyPlayed.played_at" if not time_windows.get("sampleSize") else None,
                "multiple temporal snapshots" if not data_quality.get("identityHistoryCount") else None,
            ],
        },
    }


def build_identity_layers(
    *,
    top_artists: list[dict] | None = None,
    top_tracks: list[dict] | None = None,
    recently_played: list[dict] | None = None,
    saved_tracks: list[dict] | None = None,
    audio_features: dict | None = None,
    audio_features_list: list[dict] | None = None,
    genres: list[Any] | None = None,
    analytics: dict | None = None,
    data_quality: dict | None = None,
) -> dict:
    top_artists = top_artists or []
    top_tracks = top_tracks or []
    recently_played = recently_played or []
    saved_tracks = saved_tracks or []
    audio_features = audio_features or {}
    audio_features_list = audio_features_list or []
    analytics = analytics or {}
    data_quality = data_quality or {}
    genre_labels = _genre_labels(genres or [], limit=12)
    artist_names = _artist_names(top_artists, limit=8)
    track_names = [_track_label(track) for track in top_tracks[:6] if _track_label(track)]
    feature_sample = len(audio_features_list)
    repeat = _repeat_context(top_tracks, recently_played, saved_tracks)
    time_windows = _time_window_stats(recently_played)

    energy = _audio_value(audio_features, "energy")
    valence = _audio_value(audio_features, "valence")
    danceability = _audio_value(audio_features, "danceability")
    acousticness = _audio_value(audio_features, "acousticness")
    instrumentalness = _audio_value(audio_features, "instrumentalness")
    speechiness = _audio_value(audio_features, "speechiness")
    tempo = _audio_value(audio_features, "tempo")
    nostalgia = _safe_float(analytics.get("nostalgiaIndex"))
    nostalgia_score = _clamp01(nostalgia / 100.0) if nostalgia is not None else None
    diversity = _safe_float(analytics.get("diversityScore"))
    diversity_score = _clamp01(diversity / 100.0) if diversity is not None else None

    atmosphere_genres = _genre_hits(genre_labels, ATMOSPHERIC_GENRE_TERMS)
    melancholy_genres = _genre_hits(genre_labels, MELANCHOLY_GENRE_TERMS)
    cinematic_genres = _genre_hits(genre_labels, CINEMATIC_GENRE_TERMS)
    rhythm_genres = _genre_hits(genre_labels, RHYTHM_GENRE_TERMS)
    atmospheric_artists = _artist_genre_hits(top_artists, ATMOSPHERIC_GENRE_TERMS)
    melancholy_artists = _artist_genre_hits(top_artists, MELANCHOLY_GENRE_TERMS)
    cinematic_artists = _artist_genre_hits(top_artists, CINEMATIC_GENRE_TERMS)

    signals: list[dict] = []

    atmosphere_score = _mean(
        [
            value
            for value in [
                acousticness,
                (1 - energy) if energy is not None else None,
                _genre_hit_score(genre_labels, ATMOSPHERIC_GENRE_TERMS),
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="atmosphere_preference",
        label="Atmosphere preference",
        score=atmosphere_score,
        confidence=min(1.0, (feature_sample / 40.0) * 0.7 + (0.3 if atmosphere_genres else 0.0)),
        evidence=[
            _feature_receipt("Average acousticness", acousticness, feature_sample),
            _feature_receipt("Average energy restraint", (1 - energy) if energy is not None else None, feature_sample),
            f"Top genre anchors include {', '.join(atmosphere_genres[:4])}" if atmosphere_genres else None,
            f"Artist anchors include {', '.join(atmospheric_artists[:4])}" if atmospheric_artists else None,
        ],
        method="mean(acousticness, inverse energy, atmospheric genre match)",
        spotify_fields=["audioFeatures.acousticness", "audioFeatures.energy", "topArtists.genres"],
    )

    melancholy_score = _mean(
        [
            value
            for value in [
                (1 - valence) if valence is not None else None,
                (1 - energy) if energy is not None else None,
                _genre_hit_score(genre_labels, MELANCHOLY_GENRE_TERMS),
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="melancholy_tendency",
        label="Melancholy tendency",
        score=melancholy_score,
        confidence=min(1.0, (feature_sample / 40.0) * 0.72 + (0.28 if melancholy_genres else 0.0)),
        evidence=[
            _feature_receipt("Average low-valence pull", (1 - valence) if valence is not None else None, feature_sample),
            f"Spotify mood classifier reads {analytics.get('mood')}" if analytics.get("mood") else None,
            f"Melancholy genre anchors include {', '.join(melancholy_genres[:4])}" if melancholy_genres else None,
            f"Artist anchors include {', '.join(melancholy_artists[:4])}" if melancholy_artists else None,
        ],
        method="mean(inverse valence, inverse energy, melancholy genre match)",
        spotify_fields=["audioFeatures.valence", "audioFeatures.energy", "analyticsMetrics.mood", "topArtists.genres"],
    )

    older_tracks = [_track_label(track) for track in top_tracks if (_release_year(track) or 3000) <= datetime.now(timezone.utc).year - 7]
    _make_signal(
        signals,
        signal_id="nostalgia_intensity",
        label="Nostalgia intensity",
        score=nostalgia_score,
        confidence=min(1.0, (analytics.get("sampleSizes") or {}).get("nostalgiaIndex", 0) / max(len(top_tracks), 1)) if top_tracks else 0.0,
        evidence=[
            f"Nostalgia index is {analytics.get('nostalgiaIndex')}% from top-track release years" if analytics.get("nostalgiaIndex") is not None else None,
            f"Older recurring anchors include {', '.join(older_tracks[:4])}" if older_tracks else None,
            f"Repeated saved/recent overlaps include {', '.join(repeat['trackOverlaps'][:3])}" if repeat["trackOverlaps"] else None,
        ],
        method="normalized top-track release age plus repeated older anchors",
        spotify_fields=["topTracks.release_date", "savedTracks", "recentlyPlayed"],
    )

    avg_popularity_values = [
        _safe_float(artist.get("popularity")) / 100.0
        for artist in top_artists
        if isinstance(artist, dict) and _safe_float(artist.get("popularity")) is not None
    ]
    avg_popularity = _mean(avg_popularity_values)
    obscure_artists = _top_obscure_artists(top_artists)
    exploration_score = _mean(
        [
            value
            for value in [
                diversity_score,
                (1 - avg_popularity) if avg_popularity is not None else None,
                min(1.0, len(genre_labels) / 12.0) if genre_labels else None,
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="exploration_tendency",
        label="Exploration tendency",
        score=exploration_score,
        confidence=min(1.0, (len(genre_labels) / 12.0) * 0.55 + (len(avg_popularity_values) / 30.0) * 0.45),
        evidence=[
            f"Genre diversity is {analytics.get('diversityScore')}% across {len(genre_labels)} top genre anchors" if analytics.get("diversityScore") is not None else None,
            f"Average top-artist popularity is {_score100(avg_popularity)}%" if avg_popularity is not None else None,
            f"Lower-mainstream artist anchors include {', '.join(obscure_artists)}" if obscure_artists else None,
        ],
        method="mean(genre entropy, inverse artist popularity, genre count)",
        spotify_fields=["topArtists.genres", "topArtists.popularity", "analyticsMetrics.diversityScore"],
    )

    comfort_score = _mean(
        [
            min(1.0, repeat["trackOverlapShare"] * 2.5),
            min(1.0, len(repeat["recurringArtists"]) / 6.0),
        ]
    )
    _make_signal(
        signals,
        signal_id="comfort_listening",
        label="Comfort listening",
        score=comfort_score,
        confidence=min(1.0, (len(top_tracks) + len(recently_played) + len(saved_tracks)) / 90.0),
        evidence=[
            f"{repeat['trackOverlapCount']} tracks repeat across top, recent, or saved Spotify windows" if repeat["trackOverlapCount"] else None,
            f"Recurring artists include {', '.join(repeat['recurringArtists'][:5])}" if repeat["recurringArtists"] else None,
            f"Repeated anchors include {', '.join(repeat['trackOverlaps'][:3])}" if repeat["trackOverlaps"] else None,
        ],
        method="overlap between top tracks, recently played tracks, saved tracks, and recurring artists",
        spotify_fields=["topTracks", "recentlyPlayed", "savedTracks"],
    )

    if time_windows["sampleSize"]:
        night_score = time_windows["nightShare"]
        _make_signal(
            signals,
            signal_id="nighttime_emotionality",
            label="Nighttime emotionality",
            score=night_score,
            confidence=min(1.0, time_windows["sampleSize"] / 40.0),
            evidence=[
                f"{time_windows['nightCount']} of {time_windows['sampleSize']} recent Spotify plays landed in late-night windows",
                _feature_receipt("Average low-valence pull", (1 - valence) if valence is not None else None, feature_sample),
            ],
            method="share of recently played timestamps between 21:00 and 04:59 UTC",
            spotify_fields=["recentlyPlayed.played_at", "audioFeatures.valence"],
        )
    else:
        _make_signal(
            signals,
            signal_id="nighttime_emotionality",
            label="Nighttime emotionality",
            score=None,
            confidence=0.0,
            evidence=["Spotify recently played timestamps are needed before this signal can be read."],
            method="requires recentlyPlayed.played_at timestamps",
            spotify_fields=["recentlyPlayed.played_at"],
            available=False,
        )

    rhythm_score = _mean(
        [
            value
            for value in [
                danceability,
                tempo,
                _genre_hit_score(genre_labels, RHYTHM_GENRE_TERMS),
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="rhythm_affinity",
        label="Rhythm affinity",
        score=rhythm_score,
        confidence=min(1.0, (feature_sample / 40.0) * 0.75 + (0.25 if rhythm_genres else 0.0)),
        evidence=[
            _feature_receipt("Average danceability", danceability, feature_sample),
            _feature_receipt("Tempo pressure", tempo, feature_sample),
            f"Rhythm-forward genres include {', '.join(rhythm_genres[:4])}" if rhythm_genres else None,
        ],
        method="mean(danceability, normalized tempo, rhythm genre match)",
        spotify_fields=["audioFeatures.danceability", "audioFeatures.tempo", "topArtists.genres"],
    )

    sonic_curiosity_score = _mean(
        [
            value
            for value in [
                diversity_score,
                instrumentalness,
                min(1.0, len(genre_labels) / 12.0) if genre_labels else None,
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="sonic_curiosity",
        label="Sonic curiosity",
        score=sonic_curiosity_score,
        confidence=min(1.0, (feature_sample / 45.0) * 0.5 + (len(genre_labels) / 12.0) * 0.5),
        evidence=[
            f"Your top artists span {len(genre_labels)} genre anchors" if genre_labels else None,
            _feature_receipt("Average instrumentalness", instrumentalness, feature_sample),
            f"Genre anchors include {', '.join(genre_labels[:5])}" if genre_labels else None,
        ],
        method="mean(genre diversity, instrumentalness, genre count)",
        spotify_fields=["topArtists.genres", "audioFeatures.instrumentalness"],
    )

    _make_signal(
        signals,
        signal_id="lyrical_focus",
        label="Voice and words focus",
        score=speechiness,
        confidence=min(1.0, feature_sample / 40.0),
        evidence=[
            _feature_receipt("Average speechiness", speechiness, feature_sample),
            "This is inferred from Spotify speechiness, not lyric text.",
        ],
        method="spotify_audio_features.speechiness; no lyric content is used",
        spotify_fields=["audioFeatures.speechiness"],
    )

    cinematic_score = _mean(
        [
            value
            for value in [
                instrumentalness,
                acousticness,
                _genre_hit_score(genre_labels, CINEMATIC_GENRE_TERMS),
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="cinematic_preference",
        label="Cinematic preference",
        score=cinematic_score,
        confidence=min(1.0, (feature_sample / 40.0) * 0.72 + (0.28 if cinematic_genres else 0.0)),
        evidence=[
            _feature_receipt("Average instrumentalness", instrumentalness, feature_sample),
            f"Cinematic genre anchors include {', '.join(cinematic_genres[:4])}" if cinematic_genres else None,
            f"Artist anchors include {', '.join(cinematic_artists[:4])}" if cinematic_artists else None,
        ],
        method="mean(instrumentalness, acousticness, cinematic genre match)",
        spotify_fields=["audioFeatures.instrumentalness", "audioFeatures.acousticness", "topArtists.genres"],
    )

    emotional_depth_score = _mean(
        [
            value
            for value in [
                (1 - valence) if valence is not None else None,
                acousticness,
                min(1.0, len(melancholy_genres + atmosphere_genres) / 6.0) if (melancholy_genres or atmosphere_genres) else None,
            ]
            if value is not None
        ]
    )
    _make_signal(
        signals,
        signal_id="emotional_depth",
        label="Emotional depth",
        score=emotional_depth_score,
        confidence=min(1.0, (feature_sample / 40.0) * 0.65 + (0.35 if (melancholy_genres or atmosphere_genres) else 0.0)),
        evidence=[
            _feature_receipt("Average low-valence pull", (1 - valence) if valence is not None else None, feature_sample),
            _feature_receipt("Average acousticness", acousticness, feature_sample),
            f"Depth-coded genres include {', '.join((melancholy_genres + atmosphere_genres)[:5])}" if (melancholy_genres or atmosphere_genres) else None,
        ],
        method="mean(inverse valence, acousticness, melancholy/atmospheric genre match)",
        spotify_fields=["audioFeatures.valence", "audioFeatures.acousticness", "topArtists.genres"],
    )

    feature_spreads = [
        spread
        for spread in [
            _std(_audio_values(audio_features_list, "energy")),
            _std(_audio_values(audio_features_list, "valence")),
            _std(_audio_values(audio_features_list, "danceability")),
        ]
        if spread is not None
    ]
    volatility = min(1.0, (_mean(feature_spreads) or 0.0) * 3.0) if feature_spreads else None
    _make_signal(
        signals,
        signal_id="emotional_volatility",
        label="Emotional volatility",
        score=volatility,
        confidence=min(1.0, feature_sample / 40.0),
        evidence=[
            f"Energy, valence, and danceability vary across {feature_sample} top tracks" if feature_spreads else None,
            f"Average feature spread is {round((_mean(feature_spreads) or 0.0), 3)}" if feature_spreads else None,
        ],
        method="standard deviation across energy, valence, and danceability",
        spotify_fields=["audioFeaturesList.energy", "audioFeaturesList.valence", "audioFeaturesList.danceability"],
    )

    available_signals = [signal for signal in signals if signal.get("available") and signal.get("score") is not None]
    available_signals.sort(key=lambda item: (item.get("score", 0) * item.get("confidence", 0)), reverse=True)
    top_signal = available_signals[0] if available_signals else None
    top_signal_two = available_signals[1] if len(available_signals) > 1 else None

    receipts: list[str] = []
    if artist_names:
        receipts.append(f"Top artist anchors: {', '.join(artist_names[:5])}.")
    if genre_labels:
        receipts.append(f"Top genre anchors: {', '.join(genre_labels[:6])}.")
    if track_names:
        receipts.append(f"Top track anchors: {', '.join(track_names[:4])}.")
    if analytics.get("mood"):
        receipts.append(f"Spotify audio summary resolves as {analytics.get('mood')}.")
    if repeat["recurringArtists"]:
        receipts.append(f"Recurring artist memory: {', '.join(repeat['recurringArtists'][:5])}.")
    if time_windows["sampleSize"]:
        receipts.append(f"Recent time-window sample: {time_windows['nightCount']} late-night plays from {time_windows['sampleSize']} timestamped plays.")

    if top_signal:
        phase = f"{top_signal['label']} phase"
        if top_signal_two:
            phase = f"{top_signal['label']} with {top_signal_two['label'].lower()}"
        summary = _summary_from_signal(top_signal, artist_names, genre_labels)
        title = _title_from_signal(top_signal)
    else:
        phase = "Listening signal still forming"
        summary = "Melody Map needs more Spotify listening history before it can make an identity claim without guessing."
        title = "Spotify signal still forming"

    orb = {
        "schemaVersion": IDENTITY_SIGNAL_SCHEMA_VERSION,
        "colorDrivers": {
            "violet": _score100(_mean([atmosphere_score, cinematic_score]) if atmosphere_score is not None or cinematic_score is not None else None),
            "pink": _score100(emotional_depth_score),
            "blue": _score100(melancholy_score),
            "amber": _score100(nostalgia_score),
            "cyan": _score100(exploration_score),
        },
        "motionDrivers": {
            "pulse": _score100(energy),
            "orbit": _score100(danceability),
            "density": _score100(comfort_score),
            "drift": _score100(_mean([atmosphere_score, melancholy_score]) if atmosphere_score is not None or melancholy_score is not None else None),
        },
        "evidence": receipts[:5],
        "derivedFrom": ["audioFeatures", "topArtists.genres", "topTracks", "recentlyPlayed", "savedTracks"],
    }

    identity_dna = [
        {
            "id": signal["id"],
            "label": signal["label"],
            "pct": signal["pct"],
            "color": signal["color"],
            "icon": signal["icon"],
            "evidence": (signal.get("evidence") or [])[:2],
            "confidence": signal.get("confidence", 0),
        }
        for signal in available_signals[:6]
    ]

    music_identity = _build_sonic_field_model(
        top_artists=top_artists,
        top_tracks=top_tracks,
        recently_played=recently_played,
        saved_tracks=saved_tracks,
        audio_features=audio_features,
        audio_features_list=audio_features_list,
        analytics=analytics,
        genre_labels=genre_labels,
        artist_names=artist_names,
        track_names=track_names,
        repeat=repeat,
        time_windows=time_windows,
        atmosphere_score=atmosphere_score,
        melancholy_score=melancholy_score,
        nostalgia_score=nostalgia_score,
        exploration_score=exploration_score,
        comfort_score=comfort_score,
        rhythm_score=rhythm_score,
        sonic_curiosity_score=sonic_curiosity_score,
        cinematic_score=cinematic_score,
        emotional_depth_score=emotional_depth_score,
        volatility=volatility,
        atmosphere_genres=atmosphere_genres,
        melancholy_genres=melancholy_genres,
        data_quality=data_quality,
    )

    return {
        "schemaVersion": IDENTITY_SIGNAL_SCHEMA_VERSION,
        "signals": signals,
        "availableSignals": available_signals,
        "livingIdentity": {
            "title": title,
            "currentPhase": phase,
            "summary": summary,
            "topSignal": top_signal,
            "secondarySignal": top_signal_two,
            "receipts": receipts[:8],
            "needsMoreHistory": len(available_signals) < 3,
            "methodology": "Derived only from Spotify top artists, top tracks, audio features, recent plays, and saved tracks.",
        },
        "spotifyEvidence": {
            "artistAnchors": artist_names,
            "genreAnchors": genre_labels,
            "trackAnchors": track_names,
            "repeatContext": repeat,
            "timeWindows": time_windows,
            "receipts": receipts,
            "dataQuality": {
                "audioCoverage": data_quality.get("audioCoverage"),
                "topArtistsCount": len(top_artists),
                "topTracksCount": len(top_tracks),
                "featureSampleSize": feature_sample,
            },
        },
        "recommendationContext": {
            "anchors": artist_names[:6],
            "genres": genre_labels[:8],
            "mood": analytics.get("mood"),
            "signals": [
                {"id": signal["id"], "label": signal["label"], "pct": signal["pct"], "evidence": (signal.get("evidence") or [])[:2]}
                for signal in available_signals[:4]
            ],
            "reasonSeeds": receipts[:5],
        },
        "identityDNA": identity_dna,
        "musicIdentity": music_identity,
        "sonicAxes": music_identity.get("axes"),
        "identityMetrics": music_identity.get("metrics"),
        "sonicField": music_identity.get("sonicField"),
        "musicIdentitySummary": music_identity.get("poeticLine") or summary,
        "sonicPersonalityTitle": (music_identity.get("type") or {}).get("name") or title,
        "soulOrbProfile": orb,
    }


def _title_from_signal(signal: dict) -> str:
    mapping = {
        "atmosphere_preference": "The atmospheric listener",
        "melancholy_tendency": "The melancholy interpreter",
        "nostalgia_intensity": "The memory keeper",
        "exploration_tendency": "The sonic explorer",
        "comfort_listening": "The returning heart",
        "nighttime_emotionality": "The late-night reflector",
        "rhythm_affinity": "The pulse seeker",
        "sonic_curiosity": "The border walker",
        "lyrical_focus": "The voice listener",
        "cinematic_preference": "The cinematic dreamer",
        "emotional_depth": "The deep-feeling listener",
        "emotional_volatility": "The shifting weather",
    }
    return mapping.get(signal.get("id"), signal.get("label") or "The listening self")


def _summary_from_signal(signal: dict, artists: list[str], genres: list[str]) -> str:
    artist_text = ", ".join(artists[:4]) if artists else "your top artists"
    genre_text = ", ".join(genres[:4]) if genres else "your top genres"
    evidence = signal.get("evidence") or []
    lead = evidence[0] if evidence else f"{signal.get('label')} is your strongest derived signal"
    return f"{lead}. The read is grounded in Spotify anchors like {artist_text} and genre gravity around {genre_text}."


def attach_personality_evidence(traits: list[dict] | None, identity_layers: dict) -> list[dict] | None:
    if not traits:
        return traits
    signals_by_id = {
        signal.get("id"): signal
        for signal in (identity_layers.get("availableSignals") or identity_layers.get("signals") or [])
        if signal.get("id")
    }
    enriched: list[dict] = []
    for trait in traits:
        if not isinstance(trait, dict):
            enriched.append(trait)
            continue
        trait_id = str(trait.get("id") or "").lower()
        mapped = [signals_by_id.get(signal_id) for signal_id in SIGNAL_TO_TRAIT.get(trait_id, ())]
        mapped = [signal for signal in mapped if signal]
        evidence = []
        for signal in mapped:
            evidence.extend(signal.get("evidence") or [])
        description = trait.get("description")
        if evidence:
            description = evidence[0]
        enriched.append(
            {
                **trait,
                "evidence": evidence[:4],
                "description": description,
                "evidenceSignals": [
                    {"id": signal["id"], "label": signal["label"], "pct": signal.get("pct")}
                    for signal in mapped
                ],
                "grounded": bool(evidence),
            }
        )
    return enriched


def build_music_code_evidence(mbti_value: dict | None, audio_features: dict, genres: list[Any], artists: list[dict]) -> dict:
    if not mbti_value:
        return {}
    genre_labels = _genre_labels(genres or [], limit=8)
    artist_names = _artist_names(artists or [], limit=6)
    acousticness = _audio_value(audio_features or {}, "acousticness")
    danceability = _audio_value(audio_features or {}, "danceability")
    instrumentalness = _audio_value(audio_features or {}, "instrumentalness")
    valence = _audio_value(audio_features or {}, "valence")
    popularities = [
        _safe_float(artist.get("popularity")) / 100.0
        for artist in artists or []
        if isinstance(artist, dict) and _safe_float(artist.get("popularity")) is not None
    ]
    avg_popularity = _mean(popularities)
    spread = _std(popularities)
    axis_evidence = {
        "IE": [
            _feature_receipt("Acousticness", acousticness),
            _feature_receipt("Inverse danceability", (1 - danceability) if danceability is not None else None),
        ],
        "NS": [
            f"{len(genre_labels)} genre anchors were present in your Spotify top artists" if genre_labels else None,
            f"Genres used: {', '.join(genre_labels[:5])}" if genre_labels else None,
        ],
        "TF": [
            _feature_receipt("Instrumentalness", instrumentalness),
            _feature_receipt("Low-valence pull", (1 - valence) if valence is not None else None),
        ],
        "JP": [
            f"Artist popularity spread is {round(spread or 0, 3)} across top artists" if popularities else None,
            f"Average top-artist popularity is {_score100(avg_popularity)}%" if avg_popularity is not None else None,
        ],
    }
    clean_axis_evidence = {
        axis: [item for item in values if item]
        for axis, values in axis_evidence.items()
    }
    return {
        "methodology": "A Spotify behavior code, not a psychological diagnosis.",
        "axisEvidence": clean_axis_evidence,
        "receipts": [
            f"Artist anchors used: {', '.join(artist_names[:5])}." if artist_names else None,
            f"Genre anchors used: {', '.join(genre_labels[:6])}." if genre_labels else None,
            _feature_receipt("Acousticness", acousticness),
            _feature_receipt("Valence", valence),
        ],
    }


def attach_mbti_evidence(mbti_value: dict | None, evidence: dict) -> dict | None:
    if not mbti_value:
        return mbti_value
    axes = {}
    for axis, data in (mbti_value.get("axes") or {}).items():
        axes[axis] = {
            **data,
            "evidence": (evidence.get("axisEvidence") or {}).get(axis, []),
        }
    return {
        **mbti_value,
        "name": mbti_value.get("name") or "Spotify behavior code",
        "desc": "A four-letter shorthand derived from Spotify audio features, genre diversity, and artist popularity spread.",
        "axes": axes,
        "evidence": [item for item in (evidence.get("receipts") or []) if item],
        "methodology": evidence.get("methodology"),
    }


def normalize_genre_labels(genres: list[Any] | None, limit: int = 12) -> list[str]:
    return _genre_labels(genres or [], limit=limit)


def build_recommendation_reason(profile: dict | None, item: dict | None = None, *, mode: str = "baseline") -> dict:
    profile = profile or {}
    item = item or {}
    context = profile.get("recommendationContext") or {}
    signals = context.get("signals") or []
    anchors = context.get("anchors") or _artist_names(profile.get("topArtists") or [], limit=5)
    genres = context.get("genres") or _genre_labels(profile.get("genres") or [], limit=5)
    audio = profile.get("audioFeatures") or profile
    song_audio = item.get("audio_features") or item.get("audioFeatures") or {}
    evidence: list[str] = []

    if signals:
        top = signals[0]
        if top.get("evidence"):
            evidence.append(top["evidence"][0])
        else:
            evidence.append(f"Your strongest active signal is {top.get('label')} at {top.get('pct')}%.")
    if genres:
        evidence.append(f"It stays close to your Spotify genre gravity around {', '.join(genres[:3])}.")
    if anchors:
        evidence.append(f"It is being compared against anchor artists such as {', '.join(anchors[:3])}.")

    energy = _audio_value(audio, "energy")
    valence = _audio_value(audio, "valence")
    item_energy = _audio_value(song_audio, "energy")
    item_valence = _audio_value(song_audio, "valence")
    if energy is not None and item_energy is not None:
        delta = abs(energy - item_energy)
        if delta <= 0.16:
            evidence.append(f"Its energy is within {round(delta * 100)} points of your Spotify energy average.")
        else:
            evidence.append(f"Its energy intentionally stretches {round(delta * 100)} points away from your usual average.")
    if valence is not None and item_valence is not None:
        delta = abs(valence - item_valence)
        if delta <= 0.16:
            evidence.append(f"Its valence sits close to your usual emotional brightness.")

    if not evidence:
        if mode == "canary_learned":
            evidence.append("Matched by learned retrieval using your interaction-derived audio profile.")
        else:
            evidence.append("Matched by content similarity against your interaction-derived Spotify audio profile.")

    text = " ".join(evidence[:3])
    return {
        "text": text,
        "evidence": evidence[:5],
        "grounded": True,
        "methodology": "Recommendation explanation uses Spotify-derived profile anchors and candidate audio features when available.",
    }

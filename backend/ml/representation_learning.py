from __future__ import annotations

import hashlib
import math
import re


EMBEDDING_VERSION = "2026-04-hash-embed-v1"
EMBEDDING_DIMENSION = 48


def _normalize_text(value: str | None) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    return [token for token in cleaned.split() if token]


def _hash_index(token: str, *, salt: str = "") -> int:
    digest = hashlib.sha256(f"{salt}:{token}".encode("utf-8")).hexdigest()
    return int(digest, 16) % EMBEDDING_DIMENSION


def _normalize_vector(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in values))
    if norm == 0:
        return [0.0 for _ in values]
    return [round(value / norm, 6) for value in values]


def embed_tokens(tokens: list[str], *, salt: str = "") -> list[float]:
    vector = [0.0 for _ in range(EMBEDDING_DIMENSION)]
    if not tokens:
        return vector
    for token in tokens:
        vector[_hash_index(token, salt=salt)] += 1.0
    return _normalize_vector(vector)


def embed_artist(artist: dict | str) -> list[float]:
    if isinstance(artist, str):
        tokens = _normalize_text(artist)
    else:
        tokens = _normalize_text(artist.get("name"))
        for genre in artist.get("genres") or []:
            tokens.extend(_normalize_text(genre))
    return embed_tokens(tokens, salt="artist")


def embed_track(track: dict | str) -> list[float]:
    if isinstance(track, str):
        tokens = _normalize_text(track)
    else:
        tokens = _normalize_text(track.get("title") or track.get("name"))
        tokens.extend(_normalize_text(track.get("artist")))
        for artist in track.get("artists") or []:
            tokens.extend(_normalize_text(artist if isinstance(artist, str) else artist.get("name")))
        tokens.extend(_normalize_text(track.get("album")))
    return embed_tokens(tokens, salt="track")


def _audio_signature(audio_features: dict | None) -> list[str]:
    audio_features = audio_features or {}
    tokens: list[str] = []
    for key in ("energy", "valence", "danceability", "acousticness", "instrumentalness", "speechiness"):
        value = audio_features.get(key)
        if value is None:
            continue
        try:
            bucket = int(float(value) * 10)
        except (TypeError, ValueError):
            continue
        tokens.append(f"{key}:{bucket}")
    tempo = audio_features.get("tempo")
    if tempo is not None:
        try:
            tokens.append(f"tempo:{int(float(tempo) // 10)}")
        except (TypeError, ValueError):
            pass
    return tokens


def embed_profile(profile: dict) -> list[float]:
    tokens: list[str] = []
    for artist in (profile.get("topArtists") or profile.get("top_artists") or [])[:25]:
        tokens.extend(_normalize_text(artist if isinstance(artist, str) else artist.get("name")))
    for track in (profile.get("topTracks") or profile.get("top_tracks") or [])[:25]:
        if isinstance(track, str):
            tokens.extend(_normalize_text(track))
        else:
            tokens.extend(_normalize_text(track.get("title") or track.get("name")))
            tokens.extend(_normalize_text(track.get("artist")))
    for genre in (profile.get("genres") or [])[:20]:
        if isinstance(genre, dict):
            tokens.extend(_normalize_text(genre.get("genre")))
        else:
            tokens.extend(_normalize_text(genre))
    tokens.extend(_audio_signature(profile.get("audioFeatures") or profile.get("audio_features")))
    analytics = profile.get("analyticsMetrics") or profile.get("analytics_metrics") or {}
    tokens.extend(_normalize_text(analytics.get("mood")))
    mbti = profile.get("mbtiType") or (profile.get("mbti") or {}).get("type")
    tokens.extend(_normalize_text(mbti))
    return embed_tokens(tokens, salt="profile")


def cosine_similarity(vec_a: list[float] | None, vec_b: list[float] | None) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(float(a) * float(b) for a, b in zip(vec_a, vec_b))
    return max(0.0, min(1.0, round((dot + 1.0) / 2.0, 6)))


def summarize_profile_embeddings(profile: dict) -> dict:
    artists = profile.get("topArtists") or profile.get("top_artists") or []
    tracks = profile.get("topTracks") or profile.get("top_tracks") or []
    artist_vectors = [embed_artist(artist) for artist in artists[:12]]
    track_vectors = [embed_track(track) for track in tracks[:12]]
    return {
        "embeddingVersion": EMBEDDING_VERSION,
        "dimension": EMBEDDING_DIMENSION,
        "profileVector": embed_profile(profile),
        "artistVectors": artist_vectors,
        "trackVectors": track_vectors,
    }

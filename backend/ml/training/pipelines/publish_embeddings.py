from __future__ import annotations

from services.feature_store import register_embedding


def publish_track_embeddings(track_vectors: dict[str, list[float]], model_version: str) -> int:
    for track_key, vector in track_vectors.items():
        register_embedding("track", track_key, model_version, vector, {"source": "two-tower"})
    return len(track_vectors)


def publish_profile_embeddings(user_vectors: dict[str, list[float]], model_version: str) -> int:
    for user_id, vector in user_vectors.items():
        register_embedding("profile", user_id, model_version, vector, {"source": "two-tower"})
    return len(user_vectors)


def publish_artist_embeddings(artist_vectors: dict[str, list[float]], model_version: str) -> int:
    for artist_id, vector in artist_vectors.items():
        register_embedding("artist", artist_id, model_version, vector, {"source": "two-tower"})
    return len(artist_vectors)

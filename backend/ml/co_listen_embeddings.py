from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np
from sklearn.decomposition import TruncatedSVD


EMBEDDING_VERSION = "2026-04-colisten-svd-v1"


def _event_track_key(event: dict) -> str | None:
    if event.get("track_id"):
        return str(event["track_id"])
    title = (event.get("title") or "").strip()
    artist = (event.get("artist") or "").strip()
    if title and artist:
        return f"{title}::{artist}"
    if title:
        return title
    return None


def build_co_listen_embeddings(events: list[dict], dimensions: int = 16) -> dict:
    sessions: dict[str, list[str]] = defaultdict(list)
    track_meta: dict[str, dict] = {}

    for event in events:
        user_id = event.get("user_id") or "unknown"
        key = _event_track_key(event)
        if not key:
            continue
        sessions[user_id].append(key)
        track_meta.setdefault(
            key,
            {
                "track_id": event.get("track_id"),
                "title": event.get("title"),
                "artist": event.get("artist"),
            },
        )

    counts = Counter(key for keys in sessions.values() for key in set(keys))
    vocab = [key for key, count in counts.items() if count >= 1]
    if len(vocab) < 2:
        return {"version": EMBEDDING_VERSION, "dimensions": 0, "trackEmbeddings": {}, "profileEmbeddings": {}}

    index = {key: idx for idx, key in enumerate(vocab)}
    matrix = np.zeros((len(sessions), len(vocab)), dtype="float32")

    for row_index, (_user_id, keys) in enumerate(sessions.items()):
        session_counts = Counter(keys)
        for key, count in session_counts.items():
            col_index = index.get(key)
            if col_index is not None:
                matrix[row_index, col_index] = float(count)

    width = min(max(2, dimensions), max(2, min(matrix.shape) - 1))
    if width >= min(matrix.shape):
        width = max(1, min(matrix.shape) - 1)
    if width <= 0:
        return {"version": EMBEDDING_VERSION, "dimensions": 0, "trackEmbeddings": {}, "profileEmbeddings": {}}

    svd = TruncatedSVD(n_components=width, random_state=42)
    user_vectors = svd.fit_transform(matrix)
    item_vectors = svd.components_.T

    def _normalize(vector: np.ndarray) -> list[float]:
        norm = np.linalg.norm(vector)
        dense = vector if norm == 0 else vector / norm
        return [round(float(value), 6) for value in dense.tolist()]

    track_embeddings = {
        key: {
            "vector": _normalize(item_vectors[index[key]]),
            "meta": track_meta.get(key) or {},
        }
        for key in vocab
    }
    profile_embeddings = {
        user_id: _normalize(user_vectors[row_index])
        for row_index, user_id in enumerate(sessions.keys())
    }

    return {
        "version": EMBEDDING_VERSION,
        "dimensions": width,
        "trackEmbeddings": track_embeddings,
        "profileEmbeddings": profile_embeddings,
        "sessionCount": len(sessions),
        "trackCount": len(vocab),
    }

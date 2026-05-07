from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd

from ml.training.datasets.sequence_windows import build_session_windows
from services.feature_store import get_embedding, list_embeddings


def evaluate_retrieval(run_id: str, dataset_path: str) -> dict:
    try:
        frame = pd.read_parquet(dataset_path) if dataset_path.endswith(".parquet") else pd.read_json(dataset_path)
    except Exception:
        return {
            "model_version": run_id,
            "metrics": {"recall_at_50": 0.0, "precision_at_10": 0.0, "hit_rate_at_10": 0.0, "mrr": 0.0},
            "slices": {"all": {"count": 0}},
            "generated_at": datetime.now(UTC).isoformat(),
            "dataset_path": dataset_path,
        }
    windows = build_session_windows(frame)
    track_docs = list_embeddings("track", embedding_version=run_id, limit=50000)
    item_vectors = {doc["entity_id"]: np.asarray(doc["vector"], dtype=np.float32) for doc in track_docs if doc.get("vector")}
    recall_hits = 0
    reciprocal_ranks = []
    precision_hits = []
    for window in windows:
        user_embedding = get_embedding("profile", str(window["user_id"]), run_id)
        user_vector = np.asarray((user_embedding or {}).get("vector", []), dtype=np.float32)
        if user_vector.size == 0:
            continue
        scores = []
        query_norm = np.linalg.norm(user_vector) or 1.0
        for track_key, item_vector in item_vectors.items():
            if item_vector.shape[0] != user_vector.shape[0]:
                continue
            score = float(np.dot(user_vector, item_vector) / ((np.linalg.norm(item_vector) or 1.0) * query_norm))
            scores.append((track_key, score))
        scores.sort(key=lambda item: item[1], reverse=True)
        top_50 = [track_key for track_key, _score in scores[:50]]
        top_10 = top_50[:10]
        target_track = window["target_track"]
        recall_hits += 1 if target_track in top_50 else 0
        precision_hits.append(1.0 if target_track in top_10 else 0.0)
        reciprocal_ranks.append(1.0 / (top_50.index(target_track) + 1) if target_track in top_50 else 0.0)
    denom = max(len(windows), 1)
    metrics = {
        "recall_at_50": round(recall_hits / denom, 6),
        "precision_at_10": round(float(np.mean(precision_hits)) if precision_hits else 0.0, 6),
        "hit_rate_at_10": round(float(np.mean(precision_hits)) if precision_hits else 0.0, 6),
        "mrr": round(float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0, 6),
    }
    return {"model_version": run_id, "metrics": metrics, "slices": {"all": {"count": len(windows)}}, "generated_at": datetime.now(UTC).isoformat(), "dataset_path": dataset_path}

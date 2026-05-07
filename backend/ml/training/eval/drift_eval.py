from __future__ import annotations

from datetime import UTC, datetime

import numpy as np


def detect_embedding_drift(current_vectors: dict, baseline_vectors: dict) -> dict:
    shared = sorted(set(current_vectors) & set(baseline_vectors))
    if not shared:
        drift = 0.0
        cosine_drift = 0.0
    else:
        distances = []
        cosine_distances = []
        for key in shared:
            current = np.asarray(current_vectors[key], dtype=float)
            baseline = np.asarray(baseline_vectors[key], dtype=float)
            distances.append(float(np.linalg.norm(current - baseline)))
            current_norm = np.linalg.norm(current) or 1.0
            baseline_norm = np.linalg.norm(baseline) or 1.0
            cosine_distances.append(1.0 - float(np.dot(current, baseline) / (current_norm * baseline_norm)))
        drift = float(np.mean(distances)) if distances else 0.0
        cosine_drift = float(np.mean(cosine_distances)) if cosine_distances else 0.0
    return {
        "model_version": "drift-check-v1",
        "metrics": {"embedding_drift": drift, "cosine_drift": cosine_drift},
        "slices": {"shared_keys": {"count": len(shared)}},
        "generated_at": datetime.now(UTC).isoformat(),
    }

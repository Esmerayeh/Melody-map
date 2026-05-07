from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd


def evaluate_ranker(run_id: str, dataset_path: str) -> dict:
    try:
        frame = pd.read_parquet(dataset_path) if dataset_path.endswith(".parquet") else pd.read_json(dataset_path)
    except Exception:
        metrics = {"ndcg_at_10": 0.0, "map_at_10": 0.0, "auc": 0.0}
        return {"model_version": run_id, "metrics": metrics, "slices": {"all": {"count": 0}}, "generated_at": datetime.now(UTC).isoformat(), "dataset_path": dataset_path}
    if frame.empty:
        metrics = {"ndcg_at_10": 0.0, "map_at_10": 0.0, "auc": 0.0}
        return {"model_version": run_id, "metrics": metrics, "slices": {"all": {"count": 0}}, "generated_at": datetime.now(UTC).isoformat(), "dataset_path": dataset_path}
    labels = frame.get("label", pd.Series(np.zeros(len(frame)))).astype(float).to_numpy()
    scores = frame.get("retrieval_score", pd.Series(np.zeros(len(frame)))).astype(float).to_numpy()
    ranked = labels[np.argsort(scores)[::-1]]
    top_k = ranked[:10]
    gains = (2 ** top_k - 1) / np.log2(np.arange(2, len(top_k) + 2))
    ideal = np.sort(labels)[::-1][:10]
    ideal_gains = (2 ** ideal - 1) / np.log2(np.arange(2, len(ideal) + 2))
    ndcg = float(gains.sum() / ideal_gains.sum()) if ideal_gains.sum() else 0.0
    precision_prefix = []
    positives_seen = 0
    for index, label in enumerate(top_k, start=1):
        if label >= 0.5:
            positives_seen += 1
            precision_prefix.append(positives_seen / index)
    map_at_10 = float(np.mean(precision_prefix)) if precision_prefix else 0.0
    positives = scores[labels >= 0.5]
    negatives = scores[labels < 0.5]
    auc = float(np.mean([1.0 if pos > neg else 0.5 if pos == neg else 0.0 for pos in positives for neg in negatives])) if len(positives) and len(negatives) else 0.0
    metrics = {
        "ndcg_at_10": round(ndcg, 6),
        "map_at_10": round(map_at_10, 6),
        "auc": round(auc, 6),
    }
    return {"model_version": run_id, "metrics": metrics, "slices": {"all": {"count": len(frame)}}, "generated_at": datetime.now(UTC).isoformat(), "dataset_path": dataset_path}

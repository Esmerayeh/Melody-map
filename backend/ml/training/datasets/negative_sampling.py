from __future__ import annotations

import random


def sample_retrieval_negatives(
    positives: list[dict],
    candidate_track_keys: list[str],
    negatives_per_positive: int = 10,
    seed: int = 42,
) -> list[dict]:
    rng = random.Random(seed)
    positive_keys = {row["track_key"] for row in positives}
    available = [key for key in candidate_track_keys if key not in positive_keys]
    negatives = []
    for row in positives:
        sample_size = min(negatives_per_positive, len(available))
        for key in rng.sample(available, sample_size):
            negatives.append({"user_id": row["user_id"], "track_key": key, "label": 0, "source_positive": row["track_key"]})
    return negatives


def sample_ranker_negatives(impressions: list[dict], negatives_per_positive: int = 5) -> list[dict]:
    positives = [row for row in impressions if row.get("label", 0) > 0]
    candidate_pool = [row["track_key"] for row in impressions if row.get("label", 0) <= 0]
    return sample_retrieval_negatives(positives, candidate_pool, negatives_per_positive=negatives_per_positive, seed=77)

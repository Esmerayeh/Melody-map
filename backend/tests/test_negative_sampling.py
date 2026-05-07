from ml.training.datasets.negative_sampling import sample_ranker_negatives, sample_retrieval_negatives


def test_negative_sampling_is_deterministic():
    positives = [{"user_id": "u1", "track_key": "a"}]
    candidates = ["a", "b", "c", "d"]
    left = sample_retrieval_negatives(positives, candidates, negatives_per_positive=2, seed=1)
    right = sample_retrieval_negatives(positives, candidates, negatives_per_positive=2, seed=1)
    assert left == right


def test_ranker_negatives_exclude_positive_keys():
    impressions = [{"user_id": "u1", "track_key": "a", "label": 1}, {"user_id": "u1", "track_key": "b", "label": 0}]
    negatives = sample_ranker_negatives(impressions, negatives_per_positive=1)
    assert all(item["track_key"] != "a" for item in negatives)

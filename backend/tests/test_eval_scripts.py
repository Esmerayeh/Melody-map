from ml.training.eval.drift_eval import detect_embedding_drift
from ml.training.eval.ranking_eval import evaluate_ranker
from ml.training.eval.retrieval_eval import evaluate_retrieval
from ml.training.eval.soulmate_eval import evaluate_soulmate


def test_eval_scripts_return_metric_payloads():
    assert "metrics" in evaluate_retrieval("v1", "dataset")
    assert "metrics" in evaluate_ranker("v1", "dataset")
    assert "metrics" in evaluate_soulmate("v1", "dataset")
    assert "metrics" in detect_embedding_drift({"a": [1.0, 0.0]}, {"a": [1.0, 0.0]})

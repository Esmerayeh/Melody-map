from services.metrics_logger import _DRIFT_METRICS, _MODEL_LATENCY_LOGS, _RECOMMENDATION_OUTCOMES, log_drift_metric, log_model_latency, log_recommendation_outcome


def test_metrics_logger_records_entries():
    log_model_latency("retrieval", "v1", 10.0)
    log_recommendation_outcome({"track_key": "t1"})
    log_drift_metric("embedding_drift", 0.1, "v1")
    assert _MODEL_LATENCY_LOGS
    assert _RECOMMENDATION_OUTCOMES
    assert _DRIFT_METRICS

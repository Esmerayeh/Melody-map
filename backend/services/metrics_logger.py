from __future__ import annotations

from datetime import UTC, datetime

from prometheus_client import Counter, Histogram

_MODEL_LATENCY_LOGS = []
_RECOMMENDATION_OUTCOMES = []
_DRIFT_METRICS = []
_RECOMMENDATION_TRACES = []

MODEL_LATENCY = Histogram(
    "melodymap_model_latency_ms",
    "Model latency in milliseconds",
    labelnames=("service", "model_version"),
)
RECOMMENDATION_OUTCOME_COUNTER = Counter(
    "melodymap_recommendation_outcomes_total",
    "Recommendation outcomes by event type and model version",
    labelnames=("event_type", "model_version"),
)
DRIFT_METRIC_GAUGE = Histogram(
    "melodymap_drift_metric_value",
    "Distribution of drift metrics",
    labelnames=("metric_name", "version", "slice_name"),
)
CANDIDATE_COUNT = Histogram(
    "melodymap_recommendation_candidate_count",
    "Candidate and ranked recommendation counts",
    labelnames=("stage", "model_version"),
)
RECOMMENDATION_FALLBACK_COUNTER = Counter(
    "melodymap_recommendation_fallback_total",
    "Recommendation fallback events",
    labelnames=("stage", "reason"),
)
SHADOW_RUN_COUNTER = Counter(
    "melodymap_recommendation_shadow_total",
    "Shadow recommendation runs",
    labelnames=("mode", "retrieval_model_version", "ranking_model_version"),
)


def log_model_latency(service: str, model_version: str, latency_ms: float) -> None:
    _MODEL_LATENCY_LOGS.append({"service": service, "model_version": model_version, "latency_ms": latency_ms, "timestamp": datetime.now(UTC).isoformat()})
    MODEL_LATENCY.labels(service=service, model_version=model_version).observe(max(float(latency_ms), 0.0))


def log_recommendation_outcome(payload: dict) -> None:
    event_type = payload.get("event_type", "unknown")
    model_version = payload.get("model_version", "unknown")
    _RECOMMENDATION_OUTCOMES.append({**payload, "timestamp": datetime.now(UTC).isoformat()})
    RECOMMENDATION_OUTCOME_COUNTER.labels(event_type=event_type, model_version=model_version).inc()


def log_drift_metric(metric_name: str, value: float, version: str, slice_name: str | None = None) -> None:
    _DRIFT_METRICS.append({"metric_name": metric_name, "value": value, "version": version, "slice_name": slice_name, "timestamp": datetime.now(UTC).isoformat()})
    DRIFT_METRIC_GAUGE.labels(metric_name=metric_name, version=version, slice_name=slice_name or "all").observe(float(value))


def log_candidate_count(stage: str, model_version: str, count: int) -> None:
    CANDIDATE_COUNT.labels(stage=stage, model_version=model_version).observe(max(int(count), 0))


def log_recommendation_fallback(stage: str, reason: str) -> None:
    RECOMMENDATION_FALLBACK_COUNTER.labels(stage=stage, reason=reason).inc()


def log_shadow_run(mode: str, retrieval_model_version: str, ranking_model_version: str) -> None:
    SHADOW_RUN_COUNTER.labels(
        mode=mode,
        retrieval_model_version=retrieval_model_version,
        ranking_model_version=ranking_model_version,
    ).inc()


def log_recommendation_trace(payload: dict) -> None:
    _RECOMMENDATION_TRACES.append({**payload, "timestamp": datetime.now(UTC).isoformat()})

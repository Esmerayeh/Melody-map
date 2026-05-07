from __future__ import annotations

from services.metrics_logger import log_recommendation_outcome


def process_feedback_event(payload: dict) -> dict:
    log_recommendation_outcome(payload)
    return payload

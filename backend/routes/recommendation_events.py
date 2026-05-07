from __future__ import annotations

from flask import Blueprint, g, request

from config import Config
from middleware.auth import require_auth
from middleware.rate_limit import rate_limit
from services.event_logger import log_event
from services.kafka_producer import publish_event
from services.metrics_logger import log_recommendation_outcome
from utils.api import api_error, api_success

recommendation_events_bp = Blueprint("recommendation_events", __name__)


def _record_recommendation_event(event_type: str):
    data = request.get_json(silent=True) or {}
    if not data.get("track_key") or data.get("position") is None or not data.get("surface"):
        return api_error("track_key, position, and surface required", 400, code="RECOMMENDATION_EVENT_FIELDS_REQUIRED")
    if not data.get("recommendation_id") or not data.get("request_id"):
        return api_error("recommendation_id and request_id required", 400, code="RECOMMENDATION_ATTRIBUTION_REQUIRED")
    payload = {
        "type": event_type,
        "track_id": data.get("track_key"),
        "session_id": data.get("session_id"),
        "context": {
            "surface": data.get("surface"),
            "recommendation_id": data.get("recommendation_id"),
            "position": data.get("position"),
            "candidate_source": data.get("candidate_source"),
            "model_version": data.get("model_version"),
        },
    }
    event = log_event(g.user_id, payload, request_id=data.get("request_id") or getattr(g, "request_id", None), event_id=data.get("recommendation_id"))
    log_recommendation_outcome({**data, "event_type": event_type})
    publish_event({**event, "feedback_payload": data}, topic=Config.kafka_recommendation_feedback_topic, key=data.get("recommendation_id"))
    return api_success({"event": event}, status=202)


@recommendation_events_bp.route("/recommendations/impression", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_impression():
    return _record_recommendation_event("recommendation_impression")


@recommendation_events_bp.route("/recommendations/click", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_click():
    return _record_recommendation_event("recommendation_click")


@recommendation_events_bp.route("/recommendations/save", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_save():
    return _record_recommendation_event("recommendation_save")


@recommendation_events_bp.route("/recommendations/skip", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_skip():
    return _record_recommendation_event("recommendation_skip")


@recommendation_events_bp.route("/recommendations/replay", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_replay():
    return _record_recommendation_event("recommendation_replay")


@recommendation_events_bp.route("/recommendations/dwell", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_dwell():
    return _record_recommendation_event("recommendation_dwell")


@recommendation_events_bp.route("/recommendations/abandon", methods=["POST"])
@require_auth
@rate_limit(max_requests=120, window_seconds=60)
def recommendation_abandon():
    return _record_recommendation_event("recommendation_abandon")

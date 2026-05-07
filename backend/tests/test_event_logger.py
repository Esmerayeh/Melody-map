import pytest

from services.event_logger import EVENT_SCHEMA_VERSION, log_event, normalize_event_payload


def test_event_logger_normalizes_payload():
    event = normalize_event_payload("u1", {"type": "play", "track_id": "t1", "context": {"surface": "galaxy"}})
    assert event["schema_version"] == EVENT_SCHEMA_VERSION
    assert event["context"]["surface"] == "galaxy"


def test_event_logger_reuses_idempotency_key():
    event_a = log_event("u1", {"type": "play", "track_id": "t1"}, event_id="same-event")
    event_b = log_event("u1", {"type": "play", "track_id": "t1"}, event_id="same-event")
    assert event_a["event_id"] == event_b["event_id"]


def test_event_logger_rejects_invalid_type():
    with pytest.raises(ValueError):
        normalize_event_payload("u1", {"type": "wat"})

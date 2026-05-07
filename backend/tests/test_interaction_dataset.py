from ml.training.datasets.event_dataset import build_interaction_rows, sessionize_events


def test_interaction_dataset_sessionizes_events():
    events = [
        {"user_id": "u1", "timestamp": "2026-01-01T00:00:00+00:00", "track_id": "t1"},
        {"user_id": "u1", "timestamp": "2026-01-01T00:05:00+00:00", "track_id": "t2"},
    ]
    rows = sessionize_events(events)
    assert rows[0]["session_id"] == rows[1]["session_id"]


def test_interaction_rows_include_required_fields():
    rows = build_interaction_rows([{"user_id": "u1", "timestamp": "2026-01-01T00:00:00+00:00", "track_id": "t1", "type": "play"}])
    assert {"user_id", "track_key", "event_type", "timestamp", "session_id"}.issubset(rows[0].keys())

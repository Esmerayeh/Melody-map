from pathlib import Path

import pandas as pd

from ml.training.pipelines.train_two_tower import train_two_tower_model


def test_two_tower_training_smoke(tmp_path: Path):
    frame = pd.DataFrame([
        {"user_id": "u1", "track_key": "t1", "event_type": "play", "timestamp": "2026-01-01T00:00:00+00:00", "session_id": "s1"},
        {"user_id": "u2", "track_key": "t2", "event_type": "play", "timestamp": "2026-01-01T00:00:00+00:00", "session_id": "s2"},
    ])
    dataset_path = tmp_path / "interactions.json"
    frame.to_json(dataset_path, orient="records")
    output = train_two_tower_model(str(dataset_path), str(tmp_path / "model"), "retrieval-two-tower-v1")
    assert output["artifact_path"] or output["user_embeddings_path"]
    assert (tmp_path / "model" / "user_embeddings.json").exists()

from pathlib import Path

import pandas as pd

from ml.training.pipelines.train_ranker import train_ranker


def test_ranker_training_smoke(tmp_path: Path):
    frame = pd.DataFrame([
        {"retrieval_score": 0.8, "popularity": 0.3, "novelty": 0.5, "repeat_pressure": 0.1, "mood_compatibility": 0.7, "freshness": 0.2},
    ])
    dataset_path = tmp_path / "ranker.json"
    frame.to_json(dataset_path, orient="records")
    output = train_ranker(str(dataset_path), str(tmp_path / "model"), "ranker-v1")
    assert output["model_version"] == "ranker-v1"

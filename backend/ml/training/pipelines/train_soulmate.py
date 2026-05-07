from __future__ import annotations

import json
from pathlib import Path

from ml.training.models.soulmate_siamese import SoulmateSiameseModel


def train_soulmate(output_dir: str, model_version: str, input_dim: int = 8) -> dict:
    model = SoulmateSiameseModel(input_dim=input_dim)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    payload = {"model_version": model_version, "artifact_path": str(output / "soulmate.json"), "embedding_dim": model.embedding_dim}
    (output / "soulmate.json").write_text(json.dumps(payload), encoding="utf-8")
    return payload

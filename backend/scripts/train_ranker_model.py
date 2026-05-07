from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ml.training.pipelines.train_ranker import train_ranker


def main(
    dataset_path: str = "backend/data/processed/ranker_dataset.json",
    output_dir: str = "backend/data/models/ranker/ranker-v1",
    model_version: str = "ranker-v1",
) -> int:
    result = train_ranker(dataset_path, output_dir, model_version)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:]))

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ml.training.datasets.event_dataset import build_interaction_rows, load_listening_events


def main(output_path: str = "backend/data/processed/interactions.parquet") -> None:
    rows = build_interaction_rows(load_listening_events())
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows)
    frame.to_json(path, orient="records")


if __name__ == "__main__":
    main()

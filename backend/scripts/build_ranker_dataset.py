from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ml.training.datasets.build_ranker_table import build_ranker_rows
from ml.training.datasets.event_dataset import build_interaction_rows, load_listening_events
from ml.serving.retrieval_service import RetrievalService


def main(output_path: str = "backend/data/processed/ranker_dataset.json", top_k: int = 25) -> int:
    events = load_listening_events()
    interactions = build_interaction_rows(events)
    users = sorted({str(row["user_id"]) for row in interactions if row.get("user_id")})
    retrieval = RetrievalService()
    candidates = []
    for user_id in users:
        for candidate in retrieval.retrieve_track_candidates(user_id, top_k=top_k):
            candidates.append({"user_id": user_id, **candidate})
    rows = build_ranker_rows(interactions, candidates)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_json(path, orient="records")
    print(json.dumps({"output": str(path), "rows": len(rows), "users": len(users)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:]))

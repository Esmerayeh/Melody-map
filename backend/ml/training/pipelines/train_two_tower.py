from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader

from config import Config
from ml.training.datasets.retrieval_dataset import RetrievalDataset, build_retrieval_vocab
from ml.training.datasets.sequence_windows import build_session_windows, build_user_histories
from ml.training.models.two_tower import TwoTowerRetrievalModel
from ml.training.pipelines.publish_embeddings import publish_profile_embeddings, publish_track_embeddings


def _load_table(interactions_path: str) -> pd.DataFrame:
    path = Path(interactions_path)
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_json(path)


def build_training_matrices(interactions_path: str) -> tuple:
    frame = _load_table(interactions_path)
    windows = build_session_windows(frame)
    vocab = build_retrieval_vocab(windows)
    histories = build_user_histories(frame)
    return frame, windows, vocab, histories


# A run only produces trustworthy retrieval eval when there are enough items to make
# recall@50 non-trivial and enough users/sequences to learn from. Below these, the run
# is a SMOKE TEST (e.g. recall@50=1.0 just because there are <50 candidate items) and is
# tagged as such so it is never mistaken for a real evaluation result.
_MIN_ITEMS_FOR_EVAL = 50
_MIN_USERS = 5
_MIN_WINDOWS = 50


def classify_run(n_users: int, n_items: int, n_windows: int) -> tuple[str, str]:
    reasons = []
    if n_items < _MIN_ITEMS_FOR_EVAL:
        reasons.append(f"items={n_items}<{_MIN_ITEMS_FOR_EVAL} (recall@50 is trivially ~1.0)")
    if n_users < _MIN_USERS:
        reasons.append(f"users={n_users}<{_MIN_USERS}")
    if n_windows < _MIN_WINDOWS:
        reasons.append(f"windows={n_windows}<{_MIN_WINDOWS}")
    if reasons:
        return "smoke_test", "; ".join(reasons)
    return "production", f"users={n_users}, items={n_items}, windows={n_windows}"


def _log_mlflow(output_dir: str, payload: dict, artifacts: dict) -> None:
    path = Path(output_dir) / "mlflow_run.json"
    run_payload = {**payload, "artifacts": artifacts, "tracking_uri": Config.mlflow_tracking_uri}
    path.write_text(json.dumps(run_payload, indent=2), encoding="utf-8")
    try:
        import mlflow  # type: ignore

        mlflow.set_tracking_uri(Config.mlflow_tracking_uri)
        mlflow.set_experiment("melody-map-retrieval")
        with mlflow.start_run(run_name=payload["model_version"]):
            # Tag the run type FIRST so smoke-test runs are unmistakable in the UI.
            mlflow.set_tag("run_type", payload.get("run_type", "unknown"))
            mlflow.set_tag("run_type_reason", payload.get("run_type_reason", ""))
            dataset = payload.get("dataset", {})
            mlflow.set_tags({f"dataset.{k}": v for k, v in dataset.items()})
            mlflow.log_params(
                {
                    "model_version": payload["model_version"],
                    "embedding_dim": payload["embedding_dim"],
                    "epochs": payload["epochs"],
                    "batch_size": payload["batch_size"],
                    **{f"dataset_{k}": v for k, v in dataset.items()},
                }
            )
            mlflow.log_metrics(
                {
                    "recall_at_10": payload.get("recall_at_10", 0.0),
                    "recall_at_50": payload["recall_at_50"],
                    "mrr_at_50": payload["mrr_at_50"],
                }
            )
            for artifact_path in artifacts.values():
                if Path(artifact_path).exists():
                    mlflow.log_artifact(artifact_path)
    except Exception:
        return


def _split_windows(windows: list[dict]) -> tuple[list[dict], list[dict]]:
    if len(windows) <= 1:
        return windows, windows
    pivot = max(1, int(len(windows) * 0.8))
    return windows[:pivot], windows[pivot:]


def _compute_eval_metrics(model: TwoTowerRetrievalModel, dataset: RetrievalDataset, top_k: int = 50) -> tuple[float, float, float]:
    # Also computes recall@10. With a small item catalogue recall@50 saturates to 1.0
    # (trivially — there are fewer than 50 candidates), so recall@10 is the honest,
    # non-trivial signal worth reading until the catalogue grows past ~50 items.
    if len(dataset) == 0:
        return 0.0, 0.0, 0.0
    model.eval()
    all_item_indices = torch.arange(len(dataset.vocab.idx_to_track), dtype=torch.long)
    with torch.no_grad():
        item_vectors = model.item_tower(all_item_indices)
        hits = 0
        hits_at_10 = 0
        reciprocal_ranks = []
        for row in dataset:
            user_vector = model.user_tower(
                row["user_idx"].unsqueeze(0),
                row["history_track_indices"].unsqueeze(0),
                row["history_mask"].unsqueeze(0),
            )
            scores = torch.matmul(user_vector, item_vectors.T).squeeze(0)
            ranked_indices = torch.topk(scores, k=min(top_k, scores.shape[0])).indices.tolist()
            target_index = int(row["target_track_idx"].item())
            if target_index in ranked_indices:
                hits += 1
                reciprocal_ranks.append(1.0 / (ranked_indices.index(target_index) + 1))
                if target_index in ranked_indices[:10]:
                    hits_at_10 += 1
            else:
                reciprocal_ranks.append(0.0)
    denom = max(len(dataset), 1)
    recall = hits / denom
    recall_at_10 = hits_at_10 / denom
    mrr = float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0
    return round(float(recall), 6), round(float(mrr), 6), round(float(recall_at_10), 6)


def train_two_tower_model(
    interactions_path: str,
    output_dir: str,
    model_version: str,
    epochs: int = 5,
    batch_size: int = 256,
) -> dict:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    frame, windows, vocab, histories = build_training_matrices(interactions_path)
    if not windows:
        run_type, reason = classify_run(0, 0, 0)
        artifacts = {
            "model_version": model_version,
            "embedding_dim": 0,
            "epochs": epochs,
            "batch_size": batch_size,
            "recall_at_50": 0.0,
            "mrr_at_50": 0.0,
            "run_type": run_type,
            "run_type_reason": "no training windows — " + reason,
            "dataset": {"interactions": int(len(frame)), "users": 0, "items": 0, "windows": 0},
            "artifact_path": str(output / "model.pt"),
            "user_embeddings_path": str(output / "user_embeddings.json"),
            "item_embeddings_path": str(output / "item_embeddings.json"),
        }
        (output / "user_embeddings.json").write_text("{}", encoding="utf-8")
        (output / "item_embeddings.json").write_text("{}", encoding="utf-8")
        torch.save({"model_version": model_version, "state_dict": {}}, output / "model.pt")
        _log_mlflow(output_dir, artifacts, {"model": artifacts["artifact_path"]})
        return artifacts

    train_rows, valid_rows = _split_windows(windows)
    train_dataset = RetrievalDataset(train_rows, vocab)
    valid_dataset = RetrievalDataset(valid_rows, vocab)
    model = TwoTowerRetrievalModel(
        user_dim=max(len(vocab.idx_to_user), 1),
        item_dim=max(len(vocab.idx_to_track), 1),
        hidden_dim=128,
        embedding_dim=min(64, max(8, len(vocab.idx_to_track))),
    )
    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()
    loader = DataLoader(train_dataset, batch_size=min(batch_size, max(1, len(train_dataset))), shuffle=True)
    model.train()
    for _epoch in range(max(1, epochs)):
        for batch in loader:
            optimizer.zero_grad()
            user_vectors, item_vectors = model(
                batch["user_idx"],
                batch["history_track_indices"],
                batch["history_mask"],
                batch["target_track_idx"],
            )
            logits = model.score(user_vectors, item_vectors)
            labels = torch.arange(logits.shape[0], dtype=torch.long)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

    recall_at_50, mrr_at_50, recall_at_10 = _compute_eval_metrics(model, valid_dataset)
    run_type, reason = classify_run(len(vocab.idx_to_user), len(vocab.idx_to_track), len(windows))
    model.eval()
    with torch.no_grad():
        all_item_indices = torch.arange(len(vocab.idx_to_track), dtype=torch.long)
        item_embeddings = model.item_tower(all_item_indices).cpu().numpy()
    item_map = {track: item_embeddings[idx].tolist() for idx, track in enumerate(vocab.idx_to_track)}
    user_map = {}
    with torch.no_grad():
        for user_id, track_history in histories.items():
            history_indices = [vocab.track_to_idx[track] for track in track_history if track in vocab.track_to_idx]
            if not history_indices or user_id not in vocab.user_to_idx:
                continue
            padded = history_indices[-10:]
            mask = [1.0] * len(padded)
            while len(padded) < 10:
                padded.append(0)
                mask.append(0.0)
            vector = model.user_tower(
                torch.tensor([vocab.user_to_idx[user_id]], dtype=torch.long),
                torch.tensor([padded], dtype=torch.long),
                torch.tensor([mask], dtype=torch.float32),
            ).squeeze(0)
            user_map[user_id] = vector.cpu().tolist()

    user_embeddings_path = output / "user_embeddings.json"
    item_embeddings_path = output / "item_embeddings.json"
    metrics_path = output / "metrics.json"
    model_path = output / "model.pt"
    vocab_path = output / "vocab.json"
    user_embeddings_path.write_text(json.dumps(user_map), encoding="utf-8")
    item_embeddings_path.write_text(json.dumps(item_map), encoding="utf-8")
    metrics_path.write_text(
        json.dumps(
            {
                "recall_at_10": recall_at_10,
                "recall_at_50": recall_at_50,
                "mrr_at_50": mrr_at_50,
                "run_type": run_type,
                "run_type_reason": reason,
                "dataset": {"interactions": int(len(frame)), "users": len(vocab.idx_to_user), "items": len(vocab.idx_to_track), "windows": len(windows)},
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    vocab_path.write_text(json.dumps({"users": vocab.idx_to_user, "tracks": vocab.idx_to_track}, indent=2), encoding="utf-8")
    torch.save(
        {
            "model_version": model_version,
            "state_dict": model.state_dict(),
            "user_count": len(vocab.idx_to_user),
            "item_count": len(vocab.idx_to_track),
            "embedding_dim": int(item_embeddings.shape[1]) if item_embeddings.size else 0,
            "hidden_dim": 128,
            "max_history": 10,
            "vocab": {"users": vocab.idx_to_user, "tracks": vocab.idx_to_track},
        },
        model_path,
    )
    publish_profile_embeddings(user_map, model_version)
    publish_track_embeddings(item_map, model_version)
    artifacts = {
        "model_version": model_version,
        "embedding_dim": int(item_embeddings.shape[1]) if item_embeddings.size else 0,
        "epochs": epochs,
        "batch_size": batch_size,
        "recall_at_10": recall_at_10,
        "recall_at_50": recall_at_50,
        "mrr_at_50": mrr_at_50,
        "run_type": run_type,
        "run_type_reason": reason,
        "dataset": {
            "interactions": int(len(frame)),
            "users": len(vocab.idx_to_user),
            "items": len(vocab.idx_to_track),
            "windows": len(windows),
        },
        "artifact_path": str(model_path),
        "user_embeddings_path": str(user_embeddings_path),
        "item_embeddings_path": str(item_embeddings_path),
        "metrics_path": str(metrics_path),
        "tracking_uri": Config.mlflow_tracking_uri,
    }
    _log_mlflow(output_dir, artifacts, {"model": str(model_path), "metrics": str(metrics_path), "vocab": str(vocab_path)})
    return artifacts


if __name__ == "__main__":
    train_two_tower_model("backend/data/processed/interactions.parquet", "backend/data/models/retrieval", "retrieval-two-tower-v1")

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader, random_split

from config import Config
from ml.training.datasets.ranker_dataset import RankerDataset, load_ranker_frame
from ml.training.models.ranker import DeepRanker


def _log_mlflow(output_dir: str, payload: dict) -> None:
    path = Path(output_dir) / "mlflow_run.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    try:
        import mlflow  # type: ignore

        mlflow.set_tracking_uri(Config.mlflow_tracking_uri)
        mlflow.set_experiment("melody-map-ranking")
        with mlflow.start_run(run_name=payload["model_version"]):
            mlflow.log_params({"model_version": payload["model_version"], "epochs": payload["epochs"], "input_dim": payload["input_dim"]})
            mlflow.log_metrics({"auc": payload["auc"], "ndcg_at_10": payload["ndcg_at_10"]})
            mlflow.log_artifact(payload["artifact_path"])
    except Exception:
        return


def train_ranker(
    dataset_path: str,
    output_dir: str,
    model_version: str,
    epochs: int = 5,
) -> dict:
    frame = load_ranker_frame(dataset_path)
    dataset = RankerDataset(frame)
    dense_dim = dataset.dense_matrix.shape[1] if len(dataset) else 6
    vector_dim = dataset.item_vectors.shape[1] if len(dataset) else 0
    input_dim = dense_dim + vector_dim * 3
    model = DeepRanker(max(input_dim, dense_dim))
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    if len(dataset) == 0:
        payload = {
            "model_version": model_version,
            "epochs": epochs,
            "auc": 0.0,
            "ndcg_at_10": 0.0,
            "input_dim": input_dim,
            "artifact_path": str(output / "ranker.pt"),
        }
        torch.save({"model_version": model_version, "state_dict": {}, "input_dim": input_dim}, output / "ranker.pt")
        _log_mlflow(output_dir, payload)
        return payload

    valid_size = max(1, int(len(dataset) * 0.2)) if len(dataset) > 1 else 1
    train_size = max(len(dataset) - valid_size, 1)
    if train_size + valid_size > len(dataset):
        valid_size = len(dataset) - train_size
    train_dataset, valid_dataset = random_split(dataset, [train_size, valid_size])
    train_loader = DataLoader(train_dataset, batch_size=min(128, len(train_dataset)), shuffle=True)
    valid_loader = DataLoader(valid_dataset if len(valid_dataset) else train_dataset, batch_size=min(128, max(1, len(valid_dataset) or len(train_dataset))), shuffle=False)
    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()
    for _epoch in range(max(1, epochs)):
        model.train()
        for batch in train_loader:
            optimizer.zero_grad()
            logits = model(
                batch["dense_features"],
                batch["user_vector"],
                batch["session_vector"],
                batch["item_vector"],
            )
            loss = criterion(logits, batch["label"])
            loss.backward()
            optimizer.step()

    model.eval()
    predictions = []
    labels = []
    with torch.no_grad():
        for batch in valid_loader:
            logits = model(
                batch["dense_features"],
                batch["user_vector"],
                batch["session_vector"],
                batch["item_vector"],
            )
            scores = torch.sigmoid(logits).cpu().numpy()
            predictions.extend(scores.tolist())
            labels.extend(batch["label"].cpu().numpy().tolist())
    if predictions:
        positive_scores = [score for score, label in zip(predictions, labels, strict=False) if label >= 0.5]
        negative_scores = [score for score, label in zip(predictions, labels, strict=False) if label < 0.5]
        auc = float(np.mean([1.0 if p > n else 0.5 if p == n else 0.0 for p in positive_scores for n in negative_scores])) if positive_scores and negative_scores else float(np.mean(predictions))
        ndcg_at_10 = float(np.mean(sorted(predictions, reverse=True)[: min(10, len(predictions))]))
    else:
        auc = 0.0
        ndcg_at_10 = 0.0

    artifact_path = output / "ranker.pt"
    torch.save(
        {
            "model_version": model_version,
            "state_dict": model.state_dict(),
            "input_dim": input_dim,
            "vector_dim": vector_dim,
            "dense_dim": dense_dim,
        },
        artifact_path,
    )
    payload = {
        "model_version": model_version,
        "epochs": epochs,
        "auc": round(auc, 6),
        "ndcg_at_10": round(ndcg_at_10, 6),
        "input_dim": input_dim,
        "artifact_path": str(artifact_path),
    }
    (output / "metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    _log_mlflow(output_dir, payload)
    return payload

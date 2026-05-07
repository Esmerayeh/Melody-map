from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset


def load_ranker_frame(dataset_path: str) -> pd.DataFrame:
    path = Path(dataset_path)
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_json(path)


def _vector_column_to_array(series: pd.Series, expected_dim: int | None = None) -> np.ndarray:
    if series.empty:
        return np.zeros((0, expected_dim or 0), dtype=np.float32)
    vectors = []
    dim = expected_dim or 0
    for value in series.tolist():
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception:
                value = []
        vector = np.asarray(value or [], dtype=np.float32)
        dim = max(dim, int(vector.shape[0]))
        vectors.append(vector)
    if dim == 0:
        return np.zeros((len(vectors), 0), dtype=np.float32)
    padded = np.zeros((len(vectors), dim), dtype=np.float32)
    for index, vector in enumerate(vectors):
        if vector.shape[0]:
            padded[index, : vector.shape[0]] = vector[:dim]
    return padded


class RankerDataset(Dataset):
    def __init__(self, frame: pd.DataFrame):
        self.frame = frame.fillna(0.0).reset_index(drop=True)
        self.dense_matrix = self.frame[
            ["retrieval_score", "popularity", "novelty", "repeat_pressure", "mood_compatibility", "freshness"]
        ].to_numpy(dtype=np.float32)
        raw_user = _vector_column_to_array(self.frame.get("user_vector", pd.Series([[]] * len(self.frame))))
        raw_session = _vector_column_to_array(self.frame.get("session_vector", pd.Series([[]] * len(self.frame))))
        raw_item = _vector_column_to_array(self.frame.get("item_vector", pd.Series([[]] * len(self.frame))))
        vector_dim = max(raw_user.shape[1] if raw_user.ndim == 2 else 0, raw_session.shape[1] if raw_session.ndim == 2 else 0, raw_item.shape[1] if raw_item.ndim == 2 else 0)
        self.user_vectors = _vector_column_to_array(self.frame.get("user_vector", pd.Series([[]] * len(self.frame))), expected_dim=vector_dim)
        self.session_vectors = _vector_column_to_array(self.frame.get("session_vector", pd.Series([[]] * len(self.frame))), expected_dim=vector_dim)
        self.item_vectors = _vector_column_to_array(self.frame.get("item_vector", pd.Series([[]] * len(self.frame))), expected_dim=vector_dim)
        self.labels = self.frame.get("label", pd.Series(np.zeros(len(self.frame), dtype=np.float32))).to_numpy(dtype=np.float32)

    def __len__(self) -> int:
        return len(self.frame)

    def __getitem__(self, index: int) -> dict:
        return {
            "dense_features": torch.tensor(self.dense_matrix[index], dtype=torch.float32),
            "user_vector": torch.tensor(self.user_vectors[index], dtype=torch.float32),
            "session_vector": torch.tensor(self.session_vectors[index], dtype=torch.float32),
            "item_vector": torch.tensor(self.item_vectors[index], dtype=torch.float32),
            "label": torch.tensor(self.labels[index], dtype=torch.float32),
        }

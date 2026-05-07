from __future__ import annotations

import numpy as np

from ml.training.torch_compat import nn


class SoulmateSiameseModel(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 128, embedding_dim: int = 64):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.embedding_dim = embedding_dim
        rng = np.random.default_rng(45)
        self.weights = rng.normal(0, 0.1, size=(input_dim, embedding_dim))

    def encode(self, features):
        return np.asarray(features, dtype=float) @ self.weights

    def forward(self, left_features, right_features):
        left = self.encode(left_features)
        right = self.encode(right_features)
        left_norm = np.linalg.norm(left, axis=-1, keepdims=True) + 1e-8
        right_norm = np.linalg.norm(right, axis=-1, keepdims=True) + 1e-8
        return ((left / left_norm) * (right / right_norm)).sum(axis=-1)

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F



class UserTower(nn.Module):
    def __init__(self, user_count: int, track_count: int, hidden_dim: int = 128, embedding_dim: int = 64):
        super().__init__()
        self.user_embedding = nn.Embedding(max(user_count, 1), embedding_dim)
        self.track_embedding = nn.Embedding(max(track_count, 1), embedding_dim)
        self.mlp = nn.Sequential(
            nn.Linear(embedding_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, embedding_dim),
        )

    def forward(self, user_indices: torch.Tensor, history_track_indices: torch.Tensor, history_mask: torch.Tensor) -> torch.Tensor:
        user_vec = self.user_embedding(user_indices)
        history_vecs = self.track_embedding(history_track_indices)
        mask = history_mask.unsqueeze(-1)
        pooled_history = (history_vecs * mask).sum(dim=1) / mask.sum(dim=1).clamp_min(1.0)
        combined = torch.cat([user_vec, pooled_history], dim=-1)
        return F.normalize(self.mlp(combined), dim=-1)


class ItemTower(nn.Module):
    def __init__(self, track_count: int, hidden_dim: int = 128, embedding_dim: int = 64):
        super().__init__()
        self.track_embedding = nn.Embedding(max(track_count, 1), embedding_dim)
        self.projection = nn.Sequential(
            nn.Linear(embedding_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, embedding_dim),
        )

    def forward(self, track_indices: torch.Tensor) -> torch.Tensor:
        embedded = self.track_embedding(track_indices)
        return F.normalize(self.projection(embedded), dim=-1)


class TwoTowerRetrievalModel(nn.Module):
    def __init__(self, user_dim: int, item_dim: int, hidden_dim: int = 128, embedding_dim: int = 64):
        super().__init__()
        self.user_tower = UserTower(user_dim, item_dim, hidden_dim, embedding_dim)
        self.item_tower = ItemTower(item_dim, hidden_dim, embedding_dim)

    def forward(self, user_indices: torch.Tensor, history_track_indices: torch.Tensor, history_mask: torch.Tensor, target_track_indices: torch.Tensor):
        user_embedding = self.user_tower(user_indices, history_track_indices, history_mask)
        item_embedding = self.item_tower(target_track_indices)
        return user_embedding, item_embedding

    def score(self, user_embedding: torch.Tensor, item_embedding: torch.Tensor) -> torch.Tensor:
        return torch.matmul(user_embedding, item_embedding.T)

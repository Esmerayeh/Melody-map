from __future__ import annotations

import torch
from torch import nn



class DeepRanker(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 256):
        super().__init__()
        dense_dim = 6
        vector_dim = max((input_dim - dense_dim) // 3, 0)
        self.vector_dim = vector_dim
        self.user_proj = nn.Linear(vector_dim, hidden_dim) if vector_dim else None
        self.session_proj = nn.Linear(vector_dim, hidden_dim) if vector_dim else None
        self.item_proj = nn.Linear(vector_dim, hidden_dim) if vector_dim else None
        merged_input = dense_dim + hidden_dim * (3 if vector_dim else 0)
        self.head = nn.Sequential(
            nn.Linear(merged_input, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, dense_features, user_vector=None, session_vector=None, item_vector=None):
        parts = [dense_features]
        if self.vector_dim and self.user_proj is not None:
            parts.append(self.user_proj(user_vector))
            parts.append(self.session_proj(session_vector))
            parts.append(self.item_proj(item_vector))
        merged = torch.cat(parts, dim=-1)
        return self.head(merged).squeeze(-1)

from __future__ import annotations

from dataclasses import dataclass

import torch
from torch.utils.data import Dataset


@dataclass(frozen=True)
class RetrievalVocab:
    user_to_idx: dict[str, int]
    track_to_idx: dict[str, int]
    idx_to_user: list[str]
    idx_to_track: list[str]


def build_retrieval_vocab(rows: list[dict]) -> RetrievalVocab:
    users = sorted({str(row["user_id"]) for row in rows})
    tracks = sorted({str(row["target_track"]) for row in rows} | {track for row in rows for track in row["history_tracks"]})
    user_to_idx = {user_id: index for index, user_id in enumerate(users)}
    track_to_idx = {track_key: index for index, track_key in enumerate(tracks)}
    return RetrievalVocab(user_to_idx, track_to_idx, users, tracks)


class RetrievalDataset(Dataset):
    def __init__(self, rows: list[dict], vocab: RetrievalVocab, max_history: int = 10):
        self.rows = rows
        self.vocab = vocab
        self.max_history = max_history

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict:
        row = self.rows[index]
        history = [self.vocab.track_to_idx[track] for track in row["history_tracks"][-self.max_history :] if track in self.vocab.track_to_idx]
        mask = [1.0] * len(history)
        while len(history) < self.max_history:
            history.append(0)
            mask.append(0.0)
        return {
            "user_idx": torch.tensor(self.vocab.user_to_idx[str(row["user_id"])], dtype=torch.long),
            "history_track_indices": torch.tensor(history, dtype=torch.long),
            "history_mask": torch.tensor(mask, dtype=torch.float32),
            "target_track_idx": torch.tensor(self.vocab.track_to_idx[str(row["target_track"])], dtype=torch.long),
        }

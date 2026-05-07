from __future__ import annotations

from pathlib import Path

import torch

from config import Config
from ml.training.models.ranker import DeepRanker
from services.feature_store import get_embedding, get_online_features
from services.metrics_logger import log_model_latency


class RankingService:
    def __init__(self, model_version: str | None = None):
        self.model_version = model_version or Config.ranking_model_version
        self._model = None
        self._vector_dim = 0
        self._load_model()

    def _load_model(self) -> None:
        artifact_path = Path("backend/data/models/ranker") / self.model_version / "ranker.pt"
        if not artifact_path.exists():
            return
        payload = torch.load(artifact_path, map_location="cpu")
        self._vector_dim = int(payload.get("vector_dim", 0))
        input_dim = int(payload.get("input_dim", 6))
        model = DeepRanker(max(input_dim, 6))
        state_dict = payload.get("state_dict") or {}
        if state_dict:
            model.load_state_dict(state_dict)
            model.eval()
            self._model = model

    def rank_candidates(
        self,
        user_id: str,
        candidates: list[dict],
        session_features: dict | None = None,
        profile: dict | None = None,
    ) -> list[dict]:
        try:
            online = session_features or get_online_features(user_id) or {}
        except Exception:
            online = {}
        signal = online.get("live_signal") or {}
        user_embedding = get_embedding("profile", user_id, Config.retrieval_model_version)
        user_vector = user_embedding.get("vector", []) if user_embedding else []
        session_vector = self._build_session_vector(signal, len(user_vector))
        try:
            if self._model is not None:
                ranked = self._score_candidates(candidates, user_vector, session_vector, signal)
            else:
                ranked = self._heuristic_scores(candidates, signal)
        except Exception:
            ranked = self._heuristic_scores(candidates, signal)
        log_model_latency("ranking", self.model_version, 0.0)
        return ranked

    def _build_session_vector(self, signal: dict, dim: int) -> list[float]:
        if dim <= 0:
            return []
        seed = [
            float(signal.get("sessionIntensity", 0.0)),
            float(signal.get("noveltyScore", 0.0)),
            float(signal.get("repeatScore", 0.0)),
            float(signal.get("eventCount", 0.0)),
        ]
        values = []
        while len(values) < dim:
            values.extend(seed or [0.0])
        return values[:dim]

    def _candidate_dense_features(self, candidate: dict, signal: dict) -> list[float]:
        retrieval_score = float(candidate.get("score", candidate.get("retrieval_score", 0.0)))
        popularity = float(candidate.get("popularity", 0.0))
        novelty = float(candidate.get("novelty", signal.get("noveltyScore", 0.0)))
        repeat_pressure = float(candidate.get("repeat_pressure", signal.get("repeatScore", 0.0)))
        mood_compatibility = float(candidate.get("mood_compatibility", signal.get("sessionIntensity", 0.0)))
        freshness = float(candidate.get("freshness", min(1.0, signal.get("eventCount", 0.0) / 20.0)))
        return [retrieval_score, popularity, novelty, repeat_pressure, mood_compatibility, freshness]

    def _score_candidates(self, candidates: list[dict], user_vector: list[float], session_vector: list[float], signal: dict) -> list[dict]:
        ranked = []
        for candidate in candidates:
            item_embedding = get_embedding("track", candidate["track_key"], Config.retrieval_model_version)
            item_vector = item_embedding.get("vector", []) if item_embedding else []
            vector_dim = max(self._vector_dim, len(user_vector), len(session_vector), len(item_vector))
            if vector_dim:
                user_tensor = torch.tensor([self._pad_vector(user_vector, vector_dim)], dtype=torch.float32)
                session_tensor = torch.tensor([self._pad_vector(session_vector, vector_dim)], dtype=torch.float32)
                item_tensor = torch.tensor([self._pad_vector(item_vector, vector_dim)], dtype=torch.float32)
            else:
                user_tensor = torch.zeros((1, 0), dtype=torch.float32)
                session_tensor = torch.zeros((1, 0), dtype=torch.float32)
                item_tensor = torch.zeros((1, 0), dtype=torch.float32)
            dense_tensor = torch.tensor([self._candidate_dense_features(candidate, signal)], dtype=torch.float32)
            with torch.no_grad():
                ranking_score = torch.sigmoid(self._model(dense_tensor, user_tensor, session_tensor, item_tensor)).item()
            retrieval_score = float(candidate.get("score", candidate.get("retrieval_score", 0.0)))
            ranked.append(
                {
                    "track_key": candidate["track_key"],
                    "retrieval_score": retrieval_score,
                    "ranking_score": round(ranking_score, 6),
                    "final_score": round(ranking_score * 0.9 + retrieval_score * 0.1, 6),
                    "model_version": self.model_version,
                }
            )
        ranked.sort(key=lambda item: item["final_score"], reverse=True)
        return ranked

    def _heuristic_scores(self, candidates: list[dict], signal: dict) -> list[dict]:
        novelty_bias = float(signal.get("noveltyScore", 0.0))
        repeat_bias = float(signal.get("repeatScore", 0.0))
        ranked = []
        for candidate in candidates:
            retrieval_score = float(candidate.get("score", 0.0))
            ranking_score = retrieval_score * 0.8 + novelty_bias * 0.12 - repeat_bias * 0.04
            ranked.append(
                {
                    "track_key": candidate["track_key"],
                    "retrieval_score": retrieval_score,
                    "ranking_score": round(ranking_score, 6),
                    "final_score": round(ranking_score, 6),
                    "model_version": self.model_version,
                }
            )
        ranked.sort(key=lambda item: item["final_score"], reverse=True)
        return ranked

    @staticmethod
    def _pad_vector(vector: list[float], dim: int) -> list[float]:
        padded = list(vector[:dim])
        if len(padded) < dim:
            padded.extend([0.0] * (dim - len(padded)))
        return padded

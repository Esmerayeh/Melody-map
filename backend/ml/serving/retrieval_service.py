from __future__ import annotations

import math

from config import Config
from ml.representation_learning import summarize_profile_embeddings
from ml.serving.index_manager import IndexManager
from ml.serving.vector_index import query_faiss_index
from services.feature_store import get_embedding, list_embeddings
from services.metrics_logger import log_model_latency


class RetrievalService:
    def __init__(self, embedding_version: str | None = None):
        self.embedding_version = embedding_version or Config.retrieval_model_version
        try:
            self.index_bundle = IndexManager().load()
        except Exception:
            self.index_bundle = None

    def get_user_vector(self, user_id: str, fallback_profile: dict | None = None) -> list[float] | None:
        embedding = get_embedding("profile", user_id, self.embedding_version)
        if embedding and embedding.get("vector"):
            return embedding["vector"]
        if fallback_profile:
            reps = summarize_profile_embeddings(fallback_profile)
            return reps.get("profileVector")
        return None

    def retrieve_track_candidates(
        self,
        user_id: str,
        top_k: int = 100,
        fallback_profile: dict | None = None,
    ) -> list[dict]:
        try:
            vector = self.get_user_vector(user_id, fallback_profile=fallback_profile)
            if not vector:
                return []
            results = []
            source = "faiss"
            if self.index_bundle:
                try:
                    results = query_faiss_index(self.index_bundle, vector, top_k=top_k)
                except Exception:
                    results = []
            if not results:
                source = "fallback"
                results = self._fallback_cosine_candidates(vector, top_k=top_k)
            log_model_latency("retrieval", self.embedding_version, 0.0)
            return [
                {
                    "track_key": track_key,
                    "score": score,
                    "embedding_version": self.embedding_version,
                    "source": source,
                }
                for track_key, score in results
            ]
        except Exception:
            return []

    def _fallback_cosine_candidates(self, vector: list[float], top_k: int = 100) -> list[tuple[str, float]]:
        docs = list_embeddings("track", embedding_version=self.embedding_version, limit=max(top_k * 10, 100))
        query_norm = math.sqrt(sum(component * component for component in vector)) or 1.0
        scored = []
        for doc in docs:
            candidate = doc.get("vector") or []
            if len(candidate) != len(vector):
                continue
            candidate_norm = math.sqrt(sum(component * component for component in candidate)) or 1.0
            score = sum(left * right for left, right in zip(vector, candidate, strict=False)) / (query_norm * candidate_norm)
            scored.append((doc["entity_id"], round(float(score), 6)))
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:top_k]

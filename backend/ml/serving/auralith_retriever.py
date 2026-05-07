from __future__ import annotations

from ml.serving.retrieval_service import RetrievalService
from services.auralith_memory import retrieve_memory_chunks
from services.feature_store import get_latest_snapshot, get_recent_events, list_auralith_threads


class AuralithRetriever:
    def __init__(self) -> None:
        self.retrieval = RetrievalService()

    def retrieve(
        self,
        user_id: str,
        prompt: str,
        profile: dict | None = None,
        limit: int = 12,
    ) -> dict:
        snapshot = get_latest_snapshot(user_id) if user_id else None
        recent_events = get_recent_events(user_id, limit=min(limit, 10)) if user_id else []
        memories = list_auralith_threads(user_id, limit=3) if user_id else []
        nearest_tracks = self.retrieval.retrieve_track_candidates(user_id, top_k=min(limit, 8), fallback_profile=profile)
        nearest_artists = [{"artist": item.get("artist"), "score": item.get("score")} for item in nearest_tracks[:4]]
        rag = retrieve_memory_chunks(user_id, prompt, limit=min(limit, 8), profile=profile) if user_id else {"chunks": [], "confidence": 0.22, "source_types": [], "explanation": "No memory index available."}
        confidence = max(rag.get("confidence", 0.22), 0.25 + min(0.6, len(recent_events) * 0.04 + len(nearest_tracks) * 0.03))
        return {
            "memories": memories,
            "nearest_tracks": nearest_tracks,
            "nearest_artists": nearest_artists,
            "recent_events": recent_events,
            "snapshot": snapshot,
            "retrieved_chunks": rag.get("chunks", []),
            "source_types": rag.get("source_types", []),
            "memory_explanation": rag.get("explanation"),
            "confidence": round(confidence, 3),
        }

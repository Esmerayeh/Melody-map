import json
from pathlib import Path

from ml.serving.vector_index import build_faiss_index, save_faiss_index
from ml.serving.retrieval_service import RetrievalService
from services.feature_store import register_embedding


def test_retrieval_service_returns_candidates_for_user(tmp_path: Path, monkeypatch):
    bundle = build_faiss_index({"t1": [1.0, 0.0]})
    manifest_path = save_faiss_index(bundle, str(tmp_path))
    register_embedding("profile", "u1", "retrieval-two-tower-v1", [1.0, 0.0], {})
    monkeypatch.setattr(
        "ml.serving.retrieval_service.IndexManager",
        lambda: type("IndexManagerStub", (), {"load": lambda self: json.loads(Path(manifest_path).read_text(encoding="utf-8")) and bundle})(),
    )
    service = RetrievalService("retrieval-two-tower-v1")
    candidates = service.retrieve_track_candidates("u1", top_k=5)
    assert candidates[0]["track_key"] == "t1"


def test_retrieval_service_fallback_when_missing_user_vector():
    service = RetrievalService("retrieval-two-tower-v1")
    assert service.get_user_vector("missing-user") is None

from pathlib import Path

from ml.serving.vector_index import build_faiss_index, load_faiss_index, query_faiss_index, save_faiss_index


def test_vector_index_returns_nearest_neighbor():
    bundle = build_faiss_index({"a": [1.0, 0.0], "b": [0.0, 1.0]})
    result = query_faiss_index(bundle, [1.0, 0.0], top_k=1)
    assert result[0][0] == "a"


def test_vector_index_round_trip(tmp_path: Path):
    bundle = build_faiss_index({"a": [1.0, 0.0], "b": [0.0, 1.0]})
    manifest_path = save_faiss_index(bundle, str(tmp_path))
    loaded = load_faiss_index(manifest_path)
    result = query_faiss_index(loaded, [0.0, 1.0], top_k=1)
    assert result[0][0] == "b"

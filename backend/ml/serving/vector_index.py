from __future__ import annotations

import json
from pathlib import Path

import faiss
import numpy as np


def _normalize_matrix(matrix: np.ndarray) -> np.ndarray:
    if matrix.size == 0:
        return matrix.astype(np.float32)
    matrix = matrix.astype(np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def build_faiss_index(vectors: dict[str, list[float]]) -> dict:
    keys = list(vectors.keys())
    matrix = np.asarray([vectors[key] for key in keys], dtype=np.float32) if keys else np.zeros((0, 0), dtype=np.float32)
    matrix = _normalize_matrix(matrix)
    dimension = int(matrix.shape[1]) if matrix.ndim == 2 and matrix.shape[0] else 0
    index = faiss.IndexFlatIP(dimension) if dimension else None
    if index is not None and matrix.shape[0]:
        index.add(matrix)
    return {
        "ids": np.asarray(keys, dtype=object),
        "matrix": matrix,
        "index": index,
        "manifest": {
            "embedding_version": "unknown",
            "dimension": dimension,
            "item_count": int(matrix.shape[0]) if matrix.ndim == 2 else 0,
            "index_type": "IndexFlatIP",
        },
    }


def save_faiss_index(index_bundle: dict, output_dir: str) -> str:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    manifest = dict(index_bundle.get("manifest", {}))
    manifest_path = output / "manifest.json"
    ids_path = output / "ids.npy"
    matrix_path = output / "matrix.npy"
    index_path = output / "index.faiss"
    np.save(ids_path, index_bundle.get("ids", np.asarray([], dtype=object)), allow_pickle=True)
    np.save(matrix_path, index_bundle.get("matrix", np.zeros((0, 0), dtype=np.float32)))
    if index_bundle.get("index") is not None:
        faiss.write_index(index_bundle["index"], str(index_path))
    manifest.update(
        {
            "ids_path": str(ids_path),
            "matrix_path": str(matrix_path),
            "index_path": str(index_path),
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return str(manifest_path)


def load_faiss_index(path: str) -> dict:
    candidate = Path(path)
    if candidate.is_dir():
        candidate = candidate / "manifest.json"
    if candidate.suffix == ".json" and candidate.name == "faiss_index.json":
        compatibility = json.loads(candidate.read_text(encoding="utf-8"))
        return build_faiss_index({key: vector for key, vector in zip(compatibility.get("keys", []), compatibility.get("matrix", []), strict=False)})
    manifest = json.loads(candidate.read_text(encoding="utf-8"))
    ids = np.load(manifest["ids_path"], allow_pickle=True)
    matrix = np.load(manifest["matrix_path"])
    index = faiss.read_index(manifest["index_path"]) if Path(manifest["index_path"]).exists() else None
    return {
        "ids": ids,
        "matrix": matrix,
        "index": index,
        "manifest": manifest,
    }


def query_faiss_index(index_bundle: dict, query_vector: list[float], top_k: int = 50) -> list[tuple[str, float]]:
    matrix = np.asarray(index_bundle.get("matrix", np.zeros((0, 0), dtype=np.float32)), dtype=np.float32)
    if matrix.size == 0:
        return []
    query = np.asarray(query_vector, dtype=np.float32)
    if query.ndim != 1 or matrix.shape[1] != query.shape[0]:
        return []
    query = _normalize_matrix(query.reshape(1, -1))
    search_k = min(max(int(top_k), 1), int(matrix.shape[0]))
    index = index_bundle.get("index")
    if index is not None:
        scores, indices = index.search(query, search_k)
        ranked = zip(indices[0].tolist(), scores[0].tolist(), strict=False)
    else:
        scores = matrix @ query.squeeze(0)
        indices = np.argsort(scores)[::-1][:search_k]
        ranked = zip(indices.tolist(), scores[indices].tolist(), strict=False)
    ids = index_bundle.get("ids", [])
    results = []
    for idx, score in ranked:
        if idx < 0:
            continue
        results.append((str(ids[idx]), round(float(score), 6)))
    return results

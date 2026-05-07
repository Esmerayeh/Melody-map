from __future__ import annotations

import json
from pathlib import Path

from ml.graph_walk_embeddings import project_node_vectors


def train_projection(topology_docs: list[dict], output_dir: str, model_version: str) -> dict:
    node_vectors = {}
    for doc in topology_docs:
        topology = doc.get("galaxy_topology") or {}
        for node_id, vector in (topology.get("nodeVectors") or {}).items():
            node_vectors[node_id] = vector
    projection = project_node_vectors(node_vectors)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    payload = {"model_version": model_version, "node_count": len(projection), "artifact_path": str(output / "projection.json")}
    (output / "projection.json").write_text(json.dumps({"projection": projection, **payload}), encoding="utf-8")
    return payload

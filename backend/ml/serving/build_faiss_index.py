from __future__ import annotations

import json
from pathlib import Path

from ml.serving.vector_index import build_faiss_index, save_faiss_index
from services.feature_store import list_embeddings


def main(embedding_version: str, output_dir: str) -> None:
    docs = list_embeddings("track", embedding_version=embedding_version, limit=10000)
    vectors = {doc["entity_id"]: doc["vector"] for doc in docs if doc.get("vector")}
    bundle = build_faiss_index(vectors)
    bundle["manifest"]["embedding_version"] = embedding_version
    manifest_path = save_faiss_index(bundle, output_dir)
    active_path = Path(output_dir) / "active_index.json"
    active_path.write_text(
        json.dumps(
            {
                "active_embedding_version": embedding_version,
                "active_index_path": manifest_path,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main("retrieval-two-tower-v1", "backend/data/indexes")

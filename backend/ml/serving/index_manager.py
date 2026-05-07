from __future__ import annotations

import json
from pathlib import Path

from ml.serving.vector_index import load_faiss_index

ACTIVE_INDEX_PATH = Path("backend/data/indexes/active_index.json")


class IndexManager:
    def __init__(self) -> None:
        self._bundle = None
        self._manifest_path = None

    def _resolve_manifest_path(self) -> Path | None:
        if ACTIVE_INDEX_PATH.exists():
            payload = json.loads(ACTIVE_INDEX_PATH.read_text(encoding="utf-8"))
            raw_path = payload.get("active_index_path")
            if raw_path:
                return Path(raw_path)
        default_manifest = Path("backend/data/indexes/manifest.json")
        if default_manifest.exists():
            return default_manifest
        legacy_path = Path("backend/data/indexes/faiss_index.json")
        return legacy_path if legacy_path.exists() else None

    def load(self, force: bool = False):
        manifest_path = self._resolve_manifest_path()
        if manifest_path is None:
            self._bundle = None
            self._manifest_path = None
            return None
        if not force and self._bundle is not None and manifest_path == self._manifest_path:
            return self._bundle
        self._bundle = load_faiss_index(str(manifest_path))
        self._manifest_path = manifest_path
        return self._bundle

from __future__ import annotations

import json
import socket
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from config import Config
from services.kafka_producer import publish_event_strict
from utils.redis_client import get_redis, redis_delete, redis_read_json, redis_write_json, using_inmemory_redis


def check(label: str, status: str, detail: str) -> dict:
    return {"check": label, "status": status, "detail": detail}


def validate_kafka() -> dict:
    if not Config.kafka_bootstrap_servers:
        return check("kafka", "SKIP", "KAFKA_BOOTSTRAP_SERVERS not configured")
    ok, detail = publish_event_strict(
        {"event_id": "validate-infra", "type": "validation"},
        topic=Config.kafka_recommendation_feedback_topic,
        key="validate-infra",
    )
    return check("kafka", "PASS" if ok else "FAIL", detail)


def validate_redis() -> dict:
    if not Config.redis_url:
        return check("redis", "SKIP", "REDIS_URL not configured")
    try:
        key = "mm:validate:redis"
        payload = {"status": "ok"}
        redis_write_json(key, payload, ttl_seconds=30)
        roundtrip = redis_read_json(key)
        redis_delete(key)
        if using_inmemory_redis():
            return check("redis", "FAIL", "REDIS_URL set but in-memory fallback is active")
        return check("redis", "PASS" if roundtrip == payload else "FAIL", "strict write/read/delete roundtrip")
    except Exception as exc:
        return check("redis", "FAIL", str(exc))


def validate_mongo() -> dict:
    uri = Config.mongodb_uri
    if not uri:
        return check("mongo", "SKIP", "Mongo URI not configured")
    try:
        from pymongo import MongoClient  # type: ignore

        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        client.close()
        return check("mongo", "PASS", "ping ok")
    except Exception as exc:
        return check("mongo", "FAIL", str(exc))


def validate_mlflow() -> dict:
    uri = Config.mlflow_tracking_uri
    if not uri:
        return check("mlflow", "SKIP", "MLFLOW_TRACKING_URI not configured")
    if uri.startswith("file:"):
        target = Path(uri.replace("file:", "", 1))
        exists = target.exists()
        return check("mlflow", "PASS" if exists else "FAIL", f"filesystem backend {target}")
    try:
        with urllib.request.urlopen(uri, timeout=5) as response:
            return check("mlflow", "PASS" if response.status < 500 else "FAIL", f"http status {response.status}")
    except Exception as exc:
        return check("mlflow", "FAIL", str(exc))


def validate_artifact(label: str, path: Path) -> dict:
    return check(label, "PASS" if path.exists() else "FAIL", str(path))


def validate_metrics() -> dict:
    try:
        with urllib.request.urlopen("http://127.0.0.1:5000/metrics", timeout=3) as response:
            body = response.read().decode("utf-8", errors="ignore")
            ok = response.status == 200 and "melodymap_recommendation_candidate_count" in body
            return check("metrics_endpoint", "PASS" if ok else "FAIL", f"http status {response.status}")
    except Exception as exc:
        return check("metrics_endpoint", "FAIL", str(exc))


def main() -> int:
    results = [
        validate_kafka(),
        validate_redis(),
        validate_mongo(),
        validate_mlflow(),
        validate_artifact("faiss_manifest", ROOT / "backend" / "data" / "indexes" / "active_index.json"),
        validate_artifact("retrieval_artifact", ROOT / "backend" / "data" / "models" / "retrieval" / Config.retrieval_model_version / "model.pt"),
        validate_artifact("ranker_artifact", ROOT / "backend" / "data" / "models" / "ranker" / Config.ranking_model_version / "ranker.pt"),
        validate_metrics(),
    ]
    failures = [result for result in results if result["status"] == "FAIL"]
    status = "PASS" if not failures else "FAIL"
    print(json.dumps({"status": status, "results": results}, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

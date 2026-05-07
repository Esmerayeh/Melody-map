from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

import app as backend_app
from ml.serving.index_manager import IndexManager
import services.feature_store as feature_store
from services.feature_store import register_embedding
from services.kafka_producer import publish_event_strict
from services.stream_consumers.session_feature_consumer import process_event
from utils.redis_client import get_redis, redis_available, redis_delete, redis_read_json, redis_write_json, using_inmemory_redis


class _FakeCollection:
    def __init__(self, rows):
        self._rows = rows

    def find(self, *_args, **_kwargs):
        return self._rows


class _FakeDB:
    interactions = _FakeCollection([])
    songs = _FakeCollection(
        [
            {
                "_id": "song-1",
                "title": "Smoke Song",
                "artist": "Verifier",
                "album": "Smoke Album",
                "album_art": "https://example.com/cover.jpg",
                "spotify_url": "https://open.spotify.com/track/song-1",
                "preview_url": "https://example.com/preview.mp3",
                "audio_features": {"energy": 0.6, "valence": 0.4},
            }
        ]
    )

    def command(self, *_args, **_kwargs):
        return {"ok": 1}


class _FakeRecommendationEngine:
    def build_user_profile(self, interactions, songs):
        return {"genres": ["dream-pop"]}

    def hybrid_recommendation(self, user_id, profile, interactions, songs, limit):
        return [{"song_id": "song-1", "score": 0.45}]


def _check(label: str, passed: bool, detail: str) -> dict:
    return {"check": label, "status": "PASS" if passed else "FAIL", "detail": detail}


def main() -> int:
    results = []
    flask_app = backend_app.create_app()
    backend_app.mongo.db = _FakeDB()
    backend_app.get_recommendation_engine = lambda: _FakeRecommendationEngine()
    feature_store._mongo = None

    register_embedding("profile", "smoke-user", backend_app.Config.retrieval_model_version, [1.0, 0.0], {})
    register_embedding("track", "song-1", backend_app.Config.retrieval_model_version, [1.0, 0.0], {})

    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "smoke-user"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")

    health = client.get("/api/health")
    results.append(_check("health", health.status_code == 200, f"status={health.status_code}"))

    ranker_path = Path("backend/data/models/ranker") / backend_app.Config.ranking_model_version / "ranker.pt"
    results.append(_check("ranker_checkpoint", ranker_path.exists(), str(ranker_path)))

    active_index_path = Path("backend/data/indexes/active_index.json")
    index_bundle = None
    try:
        index_bundle = IndexManager().load()
        results.append(_check("faiss_active_index", bool(index_bundle), str(active_index_path)))
    except Exception as exc:
        results.append(_check("faiss_active_index", False, str(exc)))

    try:
        if backend_app.Config.kafka_bootstrap_servers:
            kafka_ok, kafka_detail = publish_event_strict(
                {"event_id": "smoke-event", "type": "smoke"},
                topic=backend_app.Config.kafka_recommendation_feedback_topic,
                key="smoke-event",
            )
            results.append(_check("kafka_broker_ack", kafka_ok, kafka_detail))
        else:
            results.append(_check("kafka_broker_ack", False, "KAFKA_BOOTSTRAP_SERVERS not configured"))
    except Exception as exc:
        results.append(_check("kafka_broker_ack", False, str(exc)))

    try:
        consumer_result = process_event(
            {
                "event_id": "smoke-play",
                "user_id": "smoke-user",
                "type": "play",
                "track_id": "song-1",
                "title": "Smoke Song",
                "artist": "Verifier",
                "timestamp": "2026-05-07T00:00:00+00:00",
                "received_at": "2026-05-07T00:00:00+00:00",
                "context": {"surface": "discover"},
            }
        )
        results.append(_check("consumer_redis_flow", bool(consumer_result), json.dumps(consumer_result)))
    except Exception as exc:
        results.append(_check("consumer_redis_flow", False, str(exc)))

    try:
        if backend_app.Config.redis_url:
            client = get_redis()
            key = "mm:smoke:redis"
            payload = {"status": "ok"}
            redis_write_json(key, payload, ttl_seconds=30)
            roundtrip = redis_read_json(key)
            redis_delete(key)
            redis_ok = bool(redis_available() and roundtrip == payload and not using_inmemory_redis())
            results.append(_check("redis_instance", redis_ok, "roundtrip ok" if redis_ok else "REDIS_URL set but strict instance validation failed"))
        else:
            results.append(_check("redis_instance", False, "REDIS_URL not configured"))
    except Exception as exc:
        results.append(_check("redis_instance", False, str(exc)))

    recommendation = client.get("/api/recommendations/smoke-user")
    recommendation_payload = recommendation.get_json() or {}
    rec_ok = recommendation.status_code == 200 and bool((recommendation_payload.get("data") or {}).get("items"))
    results.append(_check("recommendation_endpoint", rec_ok, json.dumps(recommendation_payload.get("data") or {})))

    metrics = client.get("/metrics")
    metrics_ok = metrics.status_code == 200 and "melodymap_recommendation_candidate_count" in metrics.get_data(as_text=True)
    results.append(_check("metrics", metrics_ok, f"status={metrics.status_code}"))

    training_artifacts = Path("backend/data/models/retrieval")
    results.append(_check("training_artifacts", training_artifacts.exists(), str(training_artifacts)))

    failures = [result for result in results if result["status"] == "FAIL"]
    report = {"status": "PASS" if not failures else "FAIL", "results": results}
    print(json.dumps(report, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

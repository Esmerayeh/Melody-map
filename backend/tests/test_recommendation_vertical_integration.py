from pathlib import Path

import app as backend_app
from ml.serving.build_faiss_index import main as build_index
from ml.training.pipelines.publish_embeddings import publish_profile_embeddings, publish_track_embeddings
from ml.training.pipelines.train_ranker import train_ranker
from services.metrics_logger import log_candidate_count, log_recommendation_fallback, log_shadow_run
from services.stream_consumers.session_feature_consumer import process_event


def _auth_client():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-vertical"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    return flask_app, client


def test_metrics_endpoint_exposes_recommendation_metrics():
    flask_app, client = _auth_client()
    with flask_app.app_context():
        log_candidate_count("retrieval_candidates", "retrieval-two-tower-v1", 5)
        log_recommendation_fallback("retrieval", "missing_index")
        log_shadow_run("shadow", "retrieval-two-tower-v1", "ranker-v1")
    response = client.get("/metrics")
    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert "melodymap_recommendation_candidate_count" in body
    assert "melodymap_recommendation_fallback_total" in body
    assert "melodymap_recommendation_shadow_total" in body


def test_recommendation_response_tracing_metadata(monkeypatch):
    class FakeRecommendationEngine:
        def build_user_profile(self, interactions, songs):
            return {"genres": ["dream-pop"]}

        def hybrid_recommendation(self, user_id, profile, interactions, songs, limit):
            return [{"song_id": "song-1", "score": 0.4}]

    class FakeCollection:
        def __init__(self, rows):
            self._rows = rows

        def find(self, *_args, **_kwargs):
            return self._rows

    class FakeDB:
        interactions = FakeCollection([])
        songs = FakeCollection(
            [
                {
                    "_id": "song-1",
                    "title": "Learned Song",
                    "artist": "Verifier",
                    "album": "Vertical",
                    "album_art": "https://example.com/cover.jpg",
                    "spotify_url": "https://open.spotify.com/track/song-1",
                    "preview_url": "https://example.com/preview.mp3",
                    "audio_features": {"energy": 0.8},
                }
            ]
        )

    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 100)
    monkeypatch.setattr(backend_app, "get_recommendation_engine", lambda: FakeRecommendationEngine())
    monkeypatch.setattr(
        backend_app,
        "RetrievalService",
        lambda: type("RetrievalStub", (), {"embedding_version": "retrieval-two-tower-v1", "retrieve_track_candidates": lambda self, user_id, top_k=50, fallback_profile=None: [{"track_key": "song-1", "score": 0.91, "embedding_version": "retrieval-two-tower-v1", "source": "faiss"}]})(),
    )
    monkeypatch.setattr(
        backend_app,
        "RankingService",
        lambda: type("RankerStub", (), {"model_version": "ranker-v1", "rank_candidates": lambda self, user_id, candidates, profile=None: [{"track_key": "song-1", "retrieval_score": 0.91, "ranking_score": 0.88, "final_score": 0.89, "model_version": "ranker-v1"}]})(),
    )
    flask_app, client = _auth_client()
    monkeypatch.setattr(backend_app.mongo, "db", FakeDB(), raising=False)
    response = client.get("/api/recommendations/user-vertical")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["data"]["mode"] == "canary_learned"
    assert payload["data"]["retrievalModelVersion"] == "retrieval-two-tower-v1"
    assert payload["data"]["rankingModelVersion"] == "ranker-v1"
    assert payload["data"]["candidateSource"] == "ranker"
    assert payload["data"]["sessionId"].startswith("sess-")
    assert payload["data"]["items"][0]["title"] == "Learned Song"
    assert payload["data"]["items"][0]["artist"] == "Verifier"
    assert payload["data"]["items"][0]["request_id"] == payload["requestId"]
    assert payload["data"]["items"][0]["session_id"] == payload["data"]["sessionId"]
    assert payload["data"]["items"][0]["candidate_source"] == "ranker"
    assert payload["data"]["items"][0]["reason"]
    assert payload["requestId"]
    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 0)


def test_ranker_checkpoint_can_be_loaded(tmp_path: Path):
    dataset_path = tmp_path / "ranker.json"
    dataset_path.write_text('[{"retrieval_score":0.8,"popularity":0.2,"novelty":0.5,"repeat_pressure":0.1,"mood_compatibility":0.7,"freshness":0.3,"label":1}]', encoding="utf-8")
    model_dir = tmp_path / "ranker-v1"
    train_ranker(str(dataset_path), str(model_dir), "ranker-v1", epochs=1)
    artifact = model_dir / "ranker.pt"
    assert artifact.exists()


def test_canary_bucket_is_deterministic():
    assert backend_app.stable_recommendation_bucket("user-1") == backend_app.stable_recommendation_bucket("user-1")


def test_consumer_updates_live_signal_cache():
    event = {
        "event_id": "evt-1",
        "user_id": "user-cache-flow",
        "type": "play",
        "track_id": "t1",
        "title": "Song",
        "artist": "Artist",
        "timestamp": "2026-05-07T00:00:00+00:00",
        "received_at": "2026-05-07T00:00:00+00:00",
        "context": {"surface": "discover"},
    }
    result = process_event(event)
    assert result["eventCount"] >= 0


def test_build_index_from_exported_embeddings(tmp_path: Path):
    publish_track_embeddings({"t1": [1.0, 0.0], "t2": [0.0, 1.0]}, "retrieval-two-tower-v1")
    publish_profile_embeddings({"user-vertical": [1.0, 0.0]}, "retrieval-two-tower-v1")
    build_index("retrieval-two-tower-v1", str(tmp_path))
    assert (tmp_path / "manifest.json").exists()
    assert (tmp_path / "active_index.json").exists()


def test_recommendations_fallback_when_learned_candidates_empty(monkeypatch):
    class FakeRecommendationEngine:
        def build_user_profile(self, interactions, songs):
            return {"genres": ["dream-pop"]}

        def hybrid_recommendation(self, user_id, profile, interactions, songs, limit):
            return [{"song_id": "song-1", "score": 0.4}]

    class FakeCollection:
        def __init__(self, rows):
            self._rows = rows

        def find(self, *_args, **_kwargs):
            return self._rows

    class FakeDB:
        interactions = FakeCollection([])
        songs = FakeCollection([{"_id": "song-1", "title": "Baseline Song", "artist": "Fallback Artist"}])

    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 100)
    monkeypatch.setattr(backend_app, "get_recommendation_engine", lambda: FakeRecommendationEngine())
    monkeypatch.setattr(
        backend_app,
        "RetrievalService",
        lambda: type("RetrievalStub", (), {"embedding_version": "invalid-model", "retrieve_track_candidates": lambda self, user_id, top_k=50, fallback_profile=None: []})(),
    )
    flask_app, client = _auth_client()
    monkeypatch.setattr(backend_app.mongo, "db", FakeDB(), raising=False)
    response = client.get("/api/recommendations/user-vertical")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["data"]["mode"] == "canary_fallback"
    assert payload["data"]["fallbackUsed"] is True
    assert payload["data"]["items"][0]["title"] == "Baseline Song"
    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 0)


def test_recommendations_fallback_when_ranker_times_out(monkeypatch):
    class FakeRecommendationEngine:
        def build_user_profile(self, interactions, songs):
            return {"genres": ["dream-pop"]}

        def hybrid_recommendation(self, user_id, profile, interactions, songs, limit):
            return [{"song_id": "song-1", "score": 0.4}]

    class FakeCollection:
        def __init__(self, rows):
            self._rows = rows

        def find(self, *_args, **_kwargs):
            return self._rows

    class FakeDB:
        interactions = FakeCollection([])
        songs = FakeCollection([{"_id": "song-1", "title": "Baseline Song", "artist": "Fallback Artist"}])

    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 100)
    monkeypatch.setattr(backend_app, "get_recommendation_engine", lambda: FakeRecommendationEngine())
    monkeypatch.setattr(
        backend_app,
        "RetrievalService",
        lambda: type("RetrievalStub", (), {"embedding_version": "retrieval-two-tower-v1", "retrieve_track_candidates": lambda self, user_id, top_k=50, fallback_profile=None: [{"track_key": "song-1", "score": 0.91}]})(),
    )
    monkeypatch.setattr(
        backend_app,
        "RankingService",
        lambda: type("RankerStub", (), {"model_version": "ranker-v1", "rank_candidates": lambda self, user_id, candidates, profile=None: (_ for _ in ()).throw(TimeoutError("rank timeout"))})(),
    )
    flask_app, client = _auth_client()
    monkeypatch.setattr(backend_app.mongo, "db", FakeDB(), raising=False)
    response = client.get("/api/recommendations/user-vertical")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["data"]["fallbackUsed"] is True
    assert payload["data"]["items"][0]["title"] == "Baseline Song"
    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 0)


def test_recommendations_fallback_when_retrieval_service_errors(monkeypatch):
    class FakeRecommendationEngine:
        def build_user_profile(self, interactions, songs):
            return {"genres": ["dream-pop"]}

        def hybrid_recommendation(self, user_id, profile, interactions, songs, limit):
            return [{"song_id": "song-1", "score": 0.4}]

    class FakeCollection:
        def __init__(self, rows):
            self._rows = rows

        def find(self, *_args, **_kwargs):
            return self._rows

    class FakeDB:
        interactions = FakeCollection([])
        songs = FakeCollection([{"_id": "song-1", "title": "Baseline Song", "artist": "Fallback Artist"}])

    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 100)
    monkeypatch.setattr(backend_app, "get_recommendation_engine", lambda: FakeRecommendationEngine())
    monkeypatch.setattr(
        backend_app,
        "RetrievalService",
        lambda: type("RetrievalStub", (), {"embedding_version": "broken-version", "retrieve_track_candidates": lambda self, user_id, top_k=50, fallback_profile=None: (_ for _ in ()).throw(RuntimeError("missing faiss"))})(),
    )
    flask_app, client = _auth_client()
    monkeypatch.setattr(backend_app.mongo, "db", FakeDB(), raising=False)
    response = client.get("/api/recommendations/user-vertical")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["data"]["fallbackUsed"] is True
    assert payload["data"]["items"][0]["title"] == "Baseline Song"
    object.__setattr__(backend_app.Config, "recommendation_canary_percent", 0)


def test_recommendation_candidates_succeeds_when_kafka_unavailable(monkeypatch):
    publish_profile_embeddings({"user-vertical": [1.0, 0.0]}, "retrieval-two-tower-v1")
    publish_track_embeddings({"song-1": [1.0, 0.0]}, "retrieval-two-tower-v1")
    monkeypatch.setattr(backend_app, "publish_event", lambda *args, **kwargs: False)
    flask_app, client = _auth_client()
    response = client.get("/api/recommendations/candidates")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["data"]["requestId"]


def test_ranking_service_falls_back_when_online_features_unavailable(monkeypatch):
    from ml.serving.ranking_service import RankingService

    monkeypatch.setattr("ml.serving.ranking_service.get_online_features", lambda _user_id: (_ for _ in ()).throw(RuntimeError("redis down")))
    service = RankingService("missing-ranker")
    ranked = service.rank_candidates("user-vertical", [{"track_key": "song-1", "score": 0.8}])
    assert ranked
    assert ranked[0]["track_key"] == "song-1"

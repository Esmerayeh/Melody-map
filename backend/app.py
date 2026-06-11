from __future__ import annotations

import hashlib
import time
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from bson import ObjectId
from flask import Flask, g, request
from flask_cors import CORS
from flask_pymongo import PyMongo
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from config import Config
from middleware.auth import optional_auth, require_auth
from middleware.rate_limit import rate_limit
from routes.aesthetic import aesthetic_bp
from routes.galaxy import galaxy_bp
from routes.auralith import auralith_bp
from routes.discover import discover_bp
from routes.lastfm_auth import lastfm_auth_bp
from routes.lastfm_data import lastfm_data_bp
from routes.music_profile import music_profile_bp
from routes.identity import identity_bp
from routes.pinterest_aesthetic import pinterest_bp
from routes.public_profile import init_mongo as public_profile_init_mongo
from routes.public_profile import public_profile_bp
from routes.recommendation_events import recommendation_events_bp
from routes.share import share_bp
from routes.social import social_bp
from routes.soulmate import init_mongo as soulmate_init_mongo
from routes.soulmate import soulmate_bp
from routes.spotify_auth import init_mongo as spotify_auth_init_mongo
from routes.spotify_auth import create_spotify_app_session, refresh_spotify_token
from routes.spotify_auth import spotify_auth_bp
from routes.spotify_data import spotify_data_bp
from services.feature_store import (
    get_live_signal_cached,
    get_latest_snapshot,
    get_online_features,
    get_recent_events,
    init_mongo as feature_store_init_mongo,
    register_embedding,
    store_listening_event,
    summarize_live_signal,
    upsert_offline_features,
    upsert_online_features,
    upsert_online_features_cached,
)
from services.event_logger import log_event
from services.kafka_producer import publish_event
from services.listening_identity import build_recommendation_reason
from services.metrics_logger import log_model_latency
from services.metrics_logger import log_candidate_count, log_recommendation_fallback, log_recommendation_trace, log_shadow_run
from ml.serving.ranking_service import RankingService
from ml.serving.retrieval_service import RetrievalService
from utils.api import api_error, api_success
from utils.auth_cookies import auth_token_from_request, clear_auth_cookie, set_auth_cookie
from utils.csrf import CSRF_COOKIE, csrf_valid, issue_csrf_token
from utils.jobs import job_registry
from utils.logger import logger
from utils.online_cache import write_request_trace
from utils.provider_cookies import lastfm_context_from_request, set_spotify_cookies, spotify_context_from_request

mongo = PyMongo()

_similarity_engine = None
_recommendation_engine = None
_spotify_service = None


def stable_recommendation_bucket(value: str) -> int:
    digest = hashlib.sha256(str(value).encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def _train_embedding_snapshot():
    from ml.co_listen_embeddings import build_co_listen_embeddings
    from ml.graph_walk_embeddings import GRAPH_EMBEDDING_VERSION, build_graph_walk_embeddings

    events = []
    topologies = []
    if mongo.db is not None:
        events = list(mongo.db.listening_events.find().sort("received_at", -1).limit(5000))
        topologies = list(mongo.db.taste_profiles.find({}, {"user_id": 1, "galaxy_topology": 1}).limit(200))

    result = build_co_listen_embeddings(events)
    for entity_id, payload in result.get("trackEmbeddings", {}).items():
        register_embedding("track", entity_id, result["version"], payload.get("vector", []), payload.get("meta"))
    for user_id, vector in result.get("profileEmbeddings", {}).items():
        register_embedding("profile", user_id, result["version"], vector, {"source": "co-listen"})
        upsert_offline_features(
            user_id,
            "rolling_30d",
            {
                "embeddingVersion": result["version"],
                "profileVector": vector,
                "sessionCount": result.get("sessionCount", 0),
                "trackCount": result.get("trackCount", 0),
            },
        )

    graph_summaries = []
    for entry in topologies:
        user_id = entry.get("user_id")
        topology = entry.get("galaxy_topology") or {}
        if not user_id or not topology:
            continue
        graph_result = build_graph_walk_embeddings(topology)
        register_embedding("galaxy", user_id, graph_result["version"], [graph_result.get("edgeDensity", 0.0)], {"kind": "density"})
        upsert_offline_features(
            user_id,
            "galaxy_walk",
            {
                "graphEmbeddingVersion": graph_result["version"],
                "communities": graph_result.get("communities", []),
                "edgeDensity": graph_result.get("edgeDensity", 0.0),
            },
        )
        graph_summaries.append({"user_id": user_id, "communities": len(graph_result.get("communities", []))})

    return {
        "coListenEmbeddingVersion": result.get("version"),
        "trackEmbeddings": len(result.get("trackEmbeddings", {})),
        "profileEmbeddings": len(result.get("profileEmbeddings", {})),
        "graphProfiles": len(graph_summaries),
        "graphEmbeddingVersion": GRAPH_EMBEDDING_VERSION,
    }


def get_similarity_engine():
    global _similarity_engine
    if _similarity_engine is None:
        try:
            from ml.similarity_engine import MusicSimilarityEngine

            _similarity_engine = MusicSimilarityEngine(n_clusters=10)
            logger.info({"event": "similarity_engine_loaded"})
        except Exception as exc:
            logger.error({"event": "similarity_engine_failed", "error": str(exc)})
    return _similarity_engine


def get_recommendation_engine():
    global _recommendation_engine
    if _recommendation_engine is None:
        try:
            from ml.recommendation_engine import RecommendationEngine

            _recommendation_engine = RecommendationEngine()
            logger.info({"event": "recommendation_engine_loaded"})
        except Exception as exc:
            logger.error({"event": "recommendation_engine_failed", "error": str(exc)})
    return _recommendation_engine


def get_spotify_service():
    global _spotify_service
    if _spotify_service is None:
        try:
            from services.spotify_service import SpotifyService

            _spotify_service = SpotifyService()
            logger.info({"event": "spotify_service_loaded"})
        except Exception as exc:
            logger.error({"event": "spotify_service_failed", "error": str(exc)})
    return _spotify_service


def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def validate_fields(data: dict, required: list[str]):
    return [field for field in required if not data.get(field)]


def _cors_origins() -> list[str]:
    origins = [Config.frontend_url]
    if "localhost" in Config.frontend_url or "127.0.0.1" in Config.frontend_url:
        origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])
    return sorted(set(origins))


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MONGO_URI"] = Config.mongodb_uri
    app.config["SECRET_KEY"] = Config.secret_key
    app.config["TESTING"] = Config.testing

    CORS(app, resources={r"/*": {"origins": _cors_origins()}}, supports_credentials=True)
    mongo.init_app(app, serverSelectionTimeoutMS=3000)

    with app.app_context():
        soulmate_init_mongo(mongo)
        public_profile_init_mongo(mongo)
        feature_store_init_mongo(mongo)
        spotify_auth_init_mongo(mongo)
        # Artist feature cache for Last.fm / non-Spotify semantic enrichment
        try:
            from services.artist_feature_cache import init_mongo as afc_init
            afc_init(mongo)
        except Exception:
            pass

    app.register_blueprint(spotify_auth_bp)
    app.register_blueprint(spotify_data_bp, url_prefix="/api")
    app.register_blueprint(lastfm_auth_bp)
    app.register_blueprint(lastfm_data_bp, url_prefix="/api")
    app.register_blueprint(soulmate_bp, url_prefix="/api")
    app.register_blueprint(aesthetic_bp)
    app.register_blueprint(galaxy_bp)
    app.register_blueprint(discover_bp)
    app.register_blueprint(music_profile_bp)
    app.register_blueprint(public_profile_bp)
    app.register_blueprint(pinterest_bp)
    app.register_blueprint(auralith_bp, url_prefix="/api")
    app.register_blueprint(identity_bp, url_prefix="/api")
    app.register_blueprint(social_bp, url_prefix="/api")
    app.register_blueprint(share_bp, url_prefix="/api")
    app.register_blueprint(recommendation_events_bp, url_prefix="/api")

    logger.info(
        {
            "event": "app_initialized",
            "config": Config.public_runtime_summary(),
            "routes": [str(rule) for rule in app.url_map.iter_rules()],
        }
    )

    register_hooks(app)
    register_routes(app)
    register_error_handlers(app)
    return app


def register_hooks(app: Flask) -> None:
    @app.before_request
    def _start_timer():
        g.start = time.time()
        g.request_id = request.headers.get("X-Request-ID") or f"mm-{uuid.uuid4().hex[:12]}"
        g.csrf_exempt = (
            request.method in {"GET", "HEAD", "OPTIONS"}
            or request.path in {
                "/api/auth/login",
                "/api/auth/register",
                "/auth/spotify/exchange",
                "/auth/lastfm/exchange",
                "/auth/spotify/callback",
                "/auth/lastfm/callback",
                "/auth/spotify/login",
                "/auth/lastfm/login",
            }
        )
        has_cookie_session = bool(request.cookies.get("mm_app_session") or request.cookies.get("mm_spotify_access") or request.cookies.get("mm_lastfm_session"))
        if not g.csrf_exempt and has_cookie_session and not csrf_valid(request):
            return api_error("CSRF token missing or invalid", 403, code="CSRF_INVALID")

    @app.after_request
    def _log_request(response):
        ms = round((time.time() - g.get("start", time.time())) * 1000, 1)
        response.headers["X-Request-ID"] = g.get("request_id", "")
        issue_csrf_token(response, request)
        logger.info(
            {
                "request_id": g.get("request_id"),
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "ms": ms,
                "ip": request.remote_addr,
            }
        )
        return response


def register_routes(app: Flask) -> None:
    def _derive_session_id() -> str:
        auth = request.cookies.get("mm_app_session") or ""
        spotify = request.cookies.get("mm_spotify_access") or ""
        lastfm = request.cookies.get("mm_lastfm_session") or ""
        seed = auth or spotify or lastfm or request.remote_addr or g.get("request_id") or "anonymous"
        return f"sess-{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:16]}"

    def _canary_enabled_for_user(user_id: str) -> bool:
        return Config.recommendation_canary_percent > 0 and stable_recommendation_bucket(user_id) < Config.recommendation_canary_percent

    def _snapshot_profile(user_id: str) -> dict | None:
        snapshot = get_latest_snapshot(user_id)
        return (snapshot or {}).get("payload")

    def _song_lookup_keys(song: dict) -> list[str]:
        keys: list[str] = []
        for candidate in (
            song.get("_id"),
            song.get("song_id"),
            song.get("track_id"),
            song.get("id"),
            song.get("spotify_id"),
        ):
            if candidate:
                keys.append(str(candidate))
        title = (song.get("title") or song.get("name") or "").strip()
        artist = (song.get("artist") or song.get("primary_artist") or "").strip()
        if title and artist:
            keys.append(f"{title}::{artist}")
        if title:
            keys.append(title)
        return keys

    def _build_song_index(songs: list[dict]) -> dict[str, dict]:
        index: dict[str, dict] = {}
        for song in songs:
            for key in _song_lookup_keys(song):
                index.setdefault(key, song)
        return index

    def _song_image(song: dict) -> str | None:
        images = song.get("images") or []
        first_image = images[0] if isinstance(images, list) and images else None
        return (
            song.get("image")
            or song.get("artwork")
            or song.get("album_art")
            or ((song.get("album") or {}).get("images") or [{}])[0].get("url")
            or (first_image.get("url") if isinstance(first_image, dict) else first_image)
        )

    def _song_spotify_url(song: dict) -> str | None:
        external_urls = song.get("external_urls") or {}
        return song.get("spotify_url") or external_urls.get("spotify")

    def _reason_payload(mode: str, item: dict, song: dict, profile: dict | None) -> dict:
        reason = build_recommendation_reason(profile, song, mode=mode)
        if item.get("reason"):
            reason["evidence"] = [item["reason"], *reason.get("evidence", [])][:5]
            reason["text"] = f"{item['reason']} {reason['text']}"
        return reason

    def _hydrate_recommendation_items(
        items: list[dict],
        songs: list[dict],
        *,
        mode: str,
        request_id: str,
        session_id: str,
        retrieval_model_version: str | None,
        ranking_model_version: str | None,
        candidate_source: str,
        profile: dict | None = None,
    ) -> list[dict]:
        song_index = _build_song_index(songs)
        hydrated: list[dict] = []
        for position, item in enumerate(items):
            track_key = str(item.get("track_key") or item.get("song_id") or "")
            song = song_index.get(track_key, {})
            title = song.get("title") or song.get("name") or track_key
            artist = song.get("artist") or song.get("primary_artist") or "Unknown artist"
            reason = _reason_payload(mode, item, song, profile)
            hydrated.append(
                {
                    "track_key": track_key,
                    "title": title,
                    "artist": artist,
                    "album": song.get("album"),
                    "image": _song_image(song),
                    "artwork": _song_image(song),
                    "album_art": song.get("album_art") or _song_image(song),
                    "preview_url": song.get("preview_url"),
                    "spotify_url": _song_spotify_url(song),
                    "audio_features": song.get("audio_features") or {},
                    "reason": reason.get("text"),
                    "reasonEvidence": reason.get("evidence", []),
                    "reasonMethodology": reason.get("methodology"),
                    "explanation": item.get("explanation") or reason.get("text"),
                    "score": item.get("score"),
                    "retrieval_score": item.get("retrieval_score"),
                    "ranking_score": item.get("ranking_score"),
                    "final_score": item.get("final_score"),
                    "position": position,
                    "request_id": request_id,
                    "session_id": session_id,
                    "retrieval_model_version": retrieval_model_version,
                    "ranking_model_version": ranking_model_version,
                    "candidate_source": candidate_source,
                    "source": item.get("source"),
                }
            )
        return hydrated

    def _shadow_retrieval_and_ranking(user_id: str, profile: dict | None = None) -> dict:
        start = time.time()
        try:
            retrieval = RetrievalService()
            ranking = RankingService()
            candidates = retrieval.retrieve_track_candidates(user_id, top_k=50, fallback_profile=profile)
            ranked = ranking.rank_candidates(user_id, candidates, profile=profile)
            latency_ms = round((time.time() - start) * 1000, 2)
            record = {
                "user_id": user_id,
                "request_id": g.get("request_id"),
                "heuristic_tracks": [],
                "retrieval_tracks": [item["track_key"] for item in candidates[:20]],
                "ranked_tracks": [item["track_key"] for item in ranked[:20]],
                "created_at": datetime.now(UTC),
                "latency_ms": latency_ms,
                "model_versions": {
                    "retrieval": retrieval.embedding_version,
                    "ranker": ranking.model_version,
                },
            }
            if getattr(mongo, "db", None) is not None:
                mongo.db.recommendation_shadow_runs.insert_one(record)
            publish_event(record, topic=Config.kafka_recommendation_request_topic, key=g.get("request_id"))
            log_shadow_run("shadow", retrieval.embedding_version, ranking.model_version)
            return record
        except Exception as exc:
            logger.warning({"event": "shadow_recommendation_failed", "error": str(exc), "user_id": user_id})
            log_recommendation_fallback("shadow", "shadow_path_failed")
            return {
                "user_id": user_id,
                "request_id": g.get("request_id"),
                "heuristic_tracks": [],
                "retrieval_tracks": [],
                "ranked_tracks": [],
                "created_at": datetime.now(UTC),
                "latency_ms": round((time.time() - start) * 1000, 2),
                "model_versions": {"retrieval": None, "ranker": None},
                "failed": True,
            }

    @app.route("/")
    def root():
        return api_success(
            {
                "status": "ok",
                "service": "melody-map-api",
                "environment": Config.environment,
            }
        )

    @app.route("/api/health")
    def health():
        db_ok = False
        db_error = None
        try:
            mongo.db.command("ping")
            db_ok = True
        except Exception as exc:
            db_error = str(exc)
            logger.warning({"event": "health_db_unreachable", "error": db_error})

        return api_success(
            {
                "status": "ok" if db_ok else "degraded",
                "database": {
                    "connected": db_ok,
                    "state": "connected" if db_ok else "unreachable",
                },
                "timestamp": datetime.now(UTC).isoformat(),
                "jobs": {"registry": "in-process", "mode": "threadpool"},
            },
            warnings=[{"code": "DATABASE_UNREACHABLE", "message": db_error}] if db_error else None,
        )

    @app.route("/api/auth/csrf", methods=["GET"])
    def csrf_bootstrap():
        return api_success({"csrf_cookie": CSRF_COOKIE})

    @app.route("/api/session/bootstrap", methods=["GET"])
    def session_bootstrap():
        auth = auth_token_from_request(request) or ""
        user_id = None
        if auth:
            try:
                payload = jwt.decode(auth, app.config["SECRET_KEY"], algorithms=["HS256"])
                user_id = payload.get("user_id")
            except jwt.InvalidTokenError:
                user_id = None

        spotify_access, spotify_refresh, spotify_expires_at = spotify_context_from_request(request)
        lastfm_session, lastfm_username = lastfm_context_from_request(request)

        # ── Self-heal the Spotify access token ───────────────────────────────
        # The access cookie lives only ~1 hour while the app session (JWT) and
        # the refresh cookie live 30 days. Without this, an authenticated user
        # whose access cookie expired reads as "Spotify disconnected" across the
        # whole app (galaxy shows demo, profile stops computing). If the access
        # cookie is gone but we hold a refresh token, mint a fresh access token
        # now and re-set the cookies so every downstream provider call works.
        refreshed_spotify = None
        if not spotify_access and spotify_refresh:
            refreshed_spotify = refresh_spotify_token(spotify_refresh)
            if refreshed_spotify:
                spotify_access = refreshed_spotify["access_token"]

        promoted_spotify_session = None
        if not user_id and spotify_access:
            promoted_spotify_session = create_spotify_app_session(spotify_access)
            if promoted_spotify_session:
                user_id = promoted_spotify_session["user_id"]

        # A provider is "connected" when we hold a usable access token OR can
        # mint one from a refresh token — the durable signal, not the 1h cookie.
        spotify_connected = bool(spotify_access or spotify_refresh)
        music_provider = "spotify" if spotify_connected else "lastfm" if lastfm_session else None
        auth_state = "authenticated" if user_id else "provider_connected" if music_provider else "no_session"
        profile_boot_status = "ready_to_hydrate" if music_provider else "awaiting_provider"

        response, status = api_success(
            {
                "auth_state": auth_state,
                "user": {"id": user_id} if user_id else None,
                "sessionId": _derive_session_id(),
                "providers": {
                    "spotify": {
                        "connected": spotify_connected,
                        "expires_at": spotify_expires_at,
                    },
                    "lastfm": {
                        "connected": bool(lastfm_session),
                        "username": lastfm_username,
                    },
                },
                "music_provider": music_provider,
                "profile_boot_status": profile_boot_status,
                "retry_after": None,
                "backend_warm": True,
                "auth_transport": "cookie" if request.cookies.get("mm_app_session") else "header" if auth else None,
                "latest_snapshot": get_latest_snapshot(user_id) if user_id else None,
            }
        )
        if refreshed_spotify:
            set_spotify_cookies(
                response,
                access_token=refreshed_spotify["access_token"],
                refresh_token=refreshed_spotify["refresh_token"],
                expires_in=refreshed_spotify["expires_in"],
            )
        if promoted_spotify_session:
            set_auth_cookie(response, promoted_spotify_session["token"], ttl_seconds=60 * 60 * 24 * 30)
        return response, status

    @app.route("/api/auth/register", methods=["POST"])
    @rate_limit(max_requests=10, window_seconds=60)
    def register():
        try:
            data = request.get_json(silent=True) or {}
            missing = validate_fields(data, ["email", "password"])
            if missing:
                return api_error(f"Missing fields: {', '.join(missing)}", 400, code="MISSING_FIELDS")
            if len(data["password"]) < 6:
                return api_error("Password must be at least 6 characters", 400, code="WEAK_PASSWORD")
            if mongo.db.users.find_one({"email": data["email"]}):
                return api_error("Email already registered", 409, code="EMAIL_IN_USE")

            hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
            user = {
                "username": data.get("username", data["email"].split("@")[0]),
                "email": data["email"],
                "password_hash": hashed,
                "created_at": datetime.utcnow(),
                "taste_profile": {},
                "playlists": [],
            }
            result = mongo.db.users.insert_one(user)
            uid = str(result.inserted_id)
            token = jwt.encode(
                {"user_id": uid, "exp": datetime.utcnow() + timedelta(days=30)},
                app.config["SECRET_KEY"],
                algorithm="HS256",
            )
            logger.info({"event": "register", "user_id": uid})
            response, status = api_success({"user_id": uid, "session": "authenticated"}, 201)
            set_auth_cookie(response, token, ttl_seconds=60 * 60 * 24 * 30)
            return response, status
        except Exception as exc:
            logger.error({"event": "register_error", "error": str(exc)})
            return api_error("Registration failed", 500, code="REGISTER_FAILED")

    @app.route("/api/auth/login", methods=["POST"])
    @rate_limit(max_requests=20, window_seconds=60)
    def login():
        try:
            data = request.get_json(silent=True) or {}
            missing = validate_fields(data, ["email", "password"])
            if missing:
                return api_error(f"Missing fields: {', '.join(missing)}", 400, code="MISSING_FIELDS")

            user = mongo.db.users.find_one({"email": data["email"]})
            if user:
                stored = user.get("password_hash")
                if not stored:
                    return api_error("Invalid credentials", 401, code="INVALID_CREDENTIALS")
                if isinstance(stored, str):
                    stored = stored.encode()
                if bcrypt.checkpw(data["password"].encode(), stored):
                    uid = str(user["_id"])
                    token = jwt.encode(
                        {"user_id": uid, "exp": datetime.utcnow() + timedelta(days=30)},
                        app.config["SECRET_KEY"],
                        algorithm="HS256",
                    )
                    logger.info({"event": "login", "user_id": uid})
                    response, status = api_success({"user_id": uid, "session": "authenticated"})
                    set_auth_cookie(response, token, ttl_seconds=60 * 60 * 24 * 30)
                    return response, status
            return api_error("Invalid credentials", 401, code="INVALID_CREDENTIALS")
        except Exception as exc:
            logger.error({"event": "login_error", "error": str(exc)})
            return api_error("Login failed", 500, code="LOGIN_FAILED")

    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        response, status = api_success({"session": "cleared"})
        clear_auth_cookie(response)
        return response, status

    @app.route("/api/map/generate", methods=["POST"])
    @require_auth
    def generate_map():
        def _compute_map():
            similarity_engine = get_similarity_engine()
            recommendation_engine = get_recommendation_engine()
            if not similarity_engine or not recommendation_engine:
                raise RuntimeError("ML engine unavailable")

            songs = list(mongo.db.songs.find().limit(500))
            if not songs:
                raise RuntimeError("Song catalog empty")

            songs_data = [serialize_doc(dict(song)) for song in songs]
            features = similarity_engine.extract_features(songs_data)
            normalized = similarity_engine.normalize_features(features)
            clusters = similarity_engine.cluster_songs(normalized)
            coords2d = similarity_engine.reduce_dimensions_pca(normalized, 2)
            coords3d = similarity_engine.reduce_dimensions_3d(normalized)

            for index, song in enumerate(songs):
                mongo.db.songs.update_one(
                    {"_id": song["_id"]},
                    {
                        "$set": {
                            "cluster_id": int(clusters[index]),
                            "map_coordinates": {"x": float(coords2d[index][0]), "y": float(coords2d[index][1])},
                            "map_coords_3d": {
                                "x": float(coords3d[index][0]),
                                "y": float(coords3d[index][1]),
                                "z": float(coords3d[index][2]),
                            },
                        }
                    },
                )

            recommendation_engine.fit_knn(songs_data)
            logger.info({"event": "map_generated", "songs": len(songs)})
            return {"message": "Map generated", "total_songs": len(songs)}

        job = job_registry.submit("map-generate", _compute_map, dedupe_key="map-generate")
        return api_success({"job_id": job["id"], "status": job["status"]}, status=202)

    @app.route("/api/map/data", methods=["GET"])
    def get_map_data():
        songs = list(mongo.db.songs.find({"map_coordinates": {"$exists": True}}))
        return api_success([serialize_doc(dict(song)) for song in songs])

    @app.route("/api/jobs/<job_id>", methods=["GET"])
    def get_job(job_id: str):
        job = job_registry.get(job_id)
        if not job:
            return api_error("Job not found", 404, code="JOB_NOT_FOUND")
        return api_success(job)

    @app.route("/api/events/listening", methods=["POST"])
    @require_auth
    @rate_limit(max_requests=120, window_seconds=60)
    def ingest_listening_event():
        data = request.get_json(silent=True) or {}
        if not data.get("track_id") and not data.get("title"):
            return api_error("track_id or title required", 400, code="EVENT_TRACK_REQUIRED")
        event_id   = request.headers.get("Idempotency-Key") or data.get("event_id")
        event      = log_event(g.user_id, data, request_id=g.get("request_id"), event_id=event_id)
        live_signal = summarize_live_signal(g.user_id, limit=24)
        upsert_online_features_cached(g.user_id, live_signal, source_event_id=event.get("event_id"))

        # ── Wire Auralith memory pipeline ──────────────────────────────────────
        # Index this event as a memory chunk so the RAG oracle can retrieve it.
        # Failures here must NEVER break listening event ingestion — warning only.
        try:
            from services.auralith_memory import build_memory_chunks
            build_memory_chunks(g.user_id, limit=8)
        except Exception as mem_exc:
            logger.warning({
                "event":   "auralith_memory_index_failed",
                "user_id": g.user_id,
                "error":   str(mem_exc),
            })

        return api_success({"event": event}, status=202)

    @app.route("/api/events/listening", methods=["GET"])
    @require_auth
    def get_listening_events():
        limit = min(max(int(request.args.get("limit", 12)), 1), 50)
        return api_success({"events": get_recent_events(g.user_id, limit=limit)})

    @app.route("/api/events/live-signal", methods=["GET"])
    @require_auth
    def get_live_signal():
        signal = get_live_signal_cached(g.user_id)
        if not signal:
            signal = summarize_live_signal(g.user_id, limit=min(max(int(request.args.get("limit", 20)), 4), 40))
        cached = get_online_features(g.user_id)
        if not cached or (cached.get("live_signal") or {}).get("eventCount", 0) != signal.get("eventCount", 0):
            cached = upsert_online_features_cached(g.user_id, signal)
        return api_success({"liveSignal": signal, "onlineFeatures": cached})

    @app.route("/api/ml/train-embeddings", methods=["POST"])
    @require_auth
    @rate_limit(max_requests=6, window_seconds=60)
    def train_embeddings():
        job = job_registry.submit("train-embeddings", _train_embedding_snapshot, dedupe_key="train-embeddings")
        return api_success({"job_id": job["id"], "status": job["status"]}, status=202)

    @app.route("/api/recommendations/candidates", methods=["GET"])
    @require_auth
    def recommendation_candidates():
        top_k = min(max(int(request.args.get("top_k", 100)), 1), 500)
        retrieval = RetrievalService()
        start = time.time()
        candidates = retrieval.retrieve_track_candidates(g.user_id, top_k=top_k, fallback_profile=_snapshot_profile(g.user_id))
        latency_ms = round((time.time() - start) * 1000, 2)
        log_model_latency("retrieval", retrieval.embedding_version, latency_ms)
        log_candidate_count("retrieval_candidates", retrieval.embedding_version, len(candidates))
        if not candidates:
            log_recommendation_fallback("retrieval", "no_candidates")
        request_trace = {
            "request_id": g.get("request_id"),
            "user_id": g.user_id,
            "candidates": candidates[:50],
            "retrieval_model_version": retrieval.embedding_version,
            "latency_ms": latency_ms,
        }
        write_request_trace(g.get("request_id"), request_trace)
        publish_event(request_trace, topic=Config.kafka_recommendation_request_topic, key=g.get("request_id"))
        log_recommendation_trace(request_trace)
        return api_success(
            {
                "candidates": candidates,
                "modelVersion": retrieval.embedding_version,
                "fallbackUsed": not bool(candidates),
                "requestId": g.get("request_id"),
                "sessionId": _derive_session_id(),
            }
        )

    @app.route("/api/recommendations/ranked", methods=["GET"])
    @require_auth
    def recommendation_ranked():
        top_k = min(max(int(request.args.get("top_k", 100)), 1), 500)
        retrieval = RetrievalService()
        ranking = RankingService()
        start = time.time()
        fallback_profile = _snapshot_profile(g.user_id)
        candidates = retrieval.retrieve_track_candidates(g.user_id, top_k=top_k, fallback_profile=fallback_profile)
        ranked = ranking.rank_candidates(g.user_id, candidates, profile=fallback_profile)
        latency_ms = round((time.time() - start) * 1000, 2)
        log_model_latency("ranking", ranking.model_version, latency_ms)
        log_candidate_count("ranking_candidates", ranking.model_version, len(ranked))
        if not ranked:
            log_recommendation_fallback("ranking", "no_ranked_results")
        request_trace = {
            "request_id": g.get("request_id"),
            "user_id": g.user_id,
            "candidates": candidates[:100],
            "ranked": ranked[:50],
            "retrieval_model_version": retrieval.embedding_version,
            "ranking_model_version": ranking.model_version,
            "latency_ms": latency_ms,
        }
        write_request_trace(g.get("request_id"), request_trace)
        publish_event(request_trace, topic=Config.kafka_recommendation_request_topic, key=g.get("request_id"))
        log_recommendation_trace(request_trace)
        return api_success(
            {
                "ranked": ranked,
                "retrievalModelVersion": retrieval.embedding_version,
                "rankingModelVersion": ranking.model_version,
                "fallbackUsed": not bool(ranked),
                "requestId": g.get("request_id"),
                "sessionId": _derive_session_id(),
            }
        )

    @app.route("/api/songs/search", methods=["GET"])
    @rate_limit(max_requests=30, window_seconds=60)
    def search_songs():
        q = request.args.get("q", "").strip()
        if not q:
            return api_success([])

        songs = list(
            mongo.db.songs.find(
                {
                    "$or": [
                        {"title": {"$regex": q, "$options": "i"}},
                        {"artist": {"$regex": q, "$options": "i"}},
                        {"album": {"$regex": q, "$options": "i"}},
                    ]
                }
            ).limit(20)
        )
        return api_success([serialize_doc(dict(song)) for song in songs])

    @app.route("/api/songs/<song_id>/similar", methods=["GET"])
    def get_similar_songs(song_id):
        similarity_engine = get_similarity_engine()
        if not similarity_engine:
            return api_error("ML engine unavailable", 503, code="ML_ENGINE_UNAVAILABLE")

        try:
            song = mongo.db.songs.find_one({"_id": ObjectId(song_id)})
        except Exception:
            return api_error("Invalid song id", 400, code="INVALID_SONG_ID")

        if not song:
            return api_error("Song not found", 404, code="SONG_NOT_FOUND")

        all_songs = list(mongo.db.songs.find())
        songs_data = [serialize_doc(dict(item)) for item in all_songs]
        features = similarity_engine.extract_features(songs_data)
        index = next((i for i, item in enumerate(all_songs) if item["_id"] == song["_id"]), None)
        if index is None:
            return api_success([])

        similar_idx, _ = similarity_engine.find_similar_songs(features[index], features, top_k=10)
        return api_success([serialize_doc(dict(all_songs[i])) for i in similar_idx])

    @app.route("/api/playlists/generate", methods=["POST"])
    @rate_limit(max_requests=20, window_seconds=60)
    def generate_playlist():
        recommendation_engine = get_recommendation_engine()
        if not recommendation_engine:
            return api_error("ML engine unavailable", 503, code="ML_ENGINE_UNAVAILABLE")

        data = request.get_json(silent=True) or {}
        mood = data.get("mood", "").strip()
        if not mood:
            return api_error("mood required", 400, code="MOOD_REQUIRED")

        songs = list(mongo.db.songs.find())
        playlist_songs = recommendation_engine.generate_mood_playlist(mood, [serialize_doc(dict(song)) for song in songs], 20)
        playlist = {
            "name": f"{mood.capitalize()} Vibes",
            "description": f"AI-generated {mood} playlist",
            "songs": [song.get("_id") for song in playlist_songs],
            "mood": mood,
            "created_at": datetime.utcnow(),
            "generated_by_ai": True,
        }
        result = mongo.db.playlists.insert_one(playlist)
        return api_success({"playlist_id": str(result.inserted_id), "songs": playlist_songs}, 201)

    @app.route("/api/playlists/<playlist_id>", methods=["GET"])
    def get_playlist(playlist_id):
        try:
            playlist = mongo.db.playlists.find_one({"_id": ObjectId(playlist_id)})
        except Exception:
            return api_error("Invalid id", 400, code="INVALID_PLAYLIST_ID")
        if not playlist:
            return api_error("Not found", 404, code="PLAYLIST_NOT_FOUND")
        return api_success(serialize_doc(dict(playlist)))

    @app.route("/api/recommendations/<user_id>", methods=["GET"])
    @rate_limit(max_requests=30, window_seconds=60)
    def get_recommendations(user_id):
        try:
            recommendation_engine = get_recommendation_engine()
            if not recommendation_engine:
                return api_error("ML engine unavailable", 503, code="ML_ENGINE_UNAVAILABLE")
            try:
                interaction_query = {"user_id": ObjectId(user_id)}
            except Exception:
                interaction_query = {"user_id": user_id}
            interactions = list(mongo.db.interactions.find(interaction_query))
            songs = [serialize_doc(dict(song)) for song in mongo.db.songs.find()]
            profile = recommendation_engine.build_user_profile(interactions, songs)
            baseline_recs = recommendation_engine.hybrid_recommendation(user_id, profile, interactions, songs, 20)
            session_id = _derive_session_id()
            shadow_result = None
            if Config.enable_shadow_retrieval or Config.enable_shadow_ranker:
                shadow_result = _shadow_retrieval_and_ranking(user_id, profile=profile if isinstance(profile, dict) else None)

            canary_enabled = _canary_enabled_for_user(user_id)
            served_mode = "baseline"
            fallback_used = False
            response_items = _hydrate_recommendation_items(
                baseline_recs,
                songs,
                mode="baseline",
                request_id=g.get("request_id"),
                session_id=session_id,
                retrieval_model_version=None,
                ranking_model_version=None,
                candidate_source="heuristic",
                profile=profile if isinstance(profile, dict) else None,
            )
            retrieval_model_version = None
            ranking_model_version = None
            learned_candidates = []
            learned_ranked = []
            if canary_enabled:
                try:
                    retrieval = RetrievalService()
                    ranking = RankingService()
                    learned_candidates = retrieval.retrieve_track_candidates(user_id, top_k=50, fallback_profile=profile if isinstance(profile, dict) else None)
                    if learned_candidates:
                        learned_ranked = ranking.rank_candidates(user_id, learned_candidates, profile=profile if isinstance(profile, dict) else None)
                    if learned_ranked:
                        retrieval_model_version = retrieval.embedding_version
                        ranking_model_version = ranking.model_version
                        response_items = _hydrate_recommendation_items(
                            learned_ranked,
                            songs,
                            mode="canary_learned",
                            request_id=g.get("request_id"),
                            session_id=session_id,
                            retrieval_model_version=retrieval_model_version,
                            ranking_model_version=ranking_model_version,
                            candidate_source="ranker",
                            profile=profile if isinstance(profile, dict) else None,
                        )
                        served_mode = "canary_learned"
                    else:
                        served_mode = "canary_fallback"
                        fallback_used = True
                        log_recommendation_fallback("serve", "learned_stack_empty")
                except Exception as exc:
                    served_mode = "canary_fallback"
                    fallback_used = True
                    logger.warning({"event": "learned_recommendation_failed", "error": str(exc), "user_id": user_id})
                    log_recommendation_fallback("serve", "learned_stack_failed")
            payload = {
                "items": response_items,
                "mode": served_mode,
                "fallbackUsed": fallback_used,
                "retrievalModelVersion": retrieval_model_version,
                "rankingModelVersion": ranking_model_version,
                "candidateSource": "ranker" if served_mode == "canary_learned" else "heuristic",
                "shadowRun": shadow_result,
                "requestId": g.get("request_id"),
                "sessionId": session_id,
            }
            log_recommendation_trace({"request_id": g.get("request_id"), "mode": served_mode, "user_id": user_id, "item_count": len(response_items)})
            return api_success(payload)
        except Exception as exc:
            logger.error({"event": "recommendations_failed", "error": str(exc), "user_id": user_id})
            return api_success([], warnings=[{"code": "RECOMMENDATIONS_DEGRADED", "message": "Recommendation pipeline degraded"}])

    @app.route("/metrics", methods=["GET"])
    def metrics():
        return app.response_class(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

    @app.route("/api/interactions", methods=["POST"])
    @require_auth
    def record_interaction():
        data = request.get_json(silent=True) or {}
        missing = validate_fields(data, ["song_id", "interaction_type"])
        if missing:
            return api_error(f"Missing: {', '.join(missing)}", 400, code="MISSING_FIELDS")
        allowed = {"like", "play", "skip", "save"}
        if data["interaction_type"] not in allowed:
            return api_error(
                f"interaction_type must be one of {sorted(allowed)}",
                400,
                code="INVALID_INTERACTION_TYPE",
            )
        mongo.db.interactions.insert_one(
            {
                "user_id": ObjectId(g.user_id),
                "song_id": data["song_id"],
                "interaction_type": data["interaction_type"],
                "timestamp": datetime.utcnow(),
            }
        )
        return api_success({"ok": True}, 201)


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(_error):
        return api_error("Not found", 404, code="NOT_FOUND")

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return api_error("Method not allowed", 405, code="METHOD_NOT_ALLOWED")

    @app.errorhandler(500)
    def internal_error(error):
        original = getattr(error, "original_exception", None) or error
        logger.error(
            {"event": "unhandled_error", "error": str(original), "path": request.path},
            exc_info=original,
        )
        return api_error("Internal server error", 500, code="INTERNAL_SERVER_ERROR")


app = create_app()


if __name__ == "__main__":
    app.run(debug=Config.debug, port=Config.port)

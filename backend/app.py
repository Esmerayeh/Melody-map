from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from bson import ObjectId
from flask import Flask, g, request
from flask_cors import CORS
from flask_pymongo import PyMongo

from config import Config
from middleware.auth import optional_auth, require_auth
from middleware.rate_limit import rate_limit
from routes.aesthetic import aesthetic_bp
from routes.auralith import auralith_bp
from routes.discover import discover_bp
from routes.lastfm_auth import lastfm_auth_bp
from routes.lastfm_data import lastfm_data_bp
from routes.music_profile import music_profile_bp
from routes.pinterest_aesthetic import pinterest_bp
from routes.public_profile import init_mongo as public_profile_init_mongo
from routes.public_profile import public_profile_bp
from routes.soulmate import init_mongo as soulmate_init_mongo
from routes.soulmate import soulmate_bp
from routes.spotify_auth import spotify_auth_bp
from routes.spotify_data import spotify_data_bp
from utils.api import api_error, api_success
from utils.logger import logger

mongo = PyMongo()

_similarity_engine = None
_recommendation_engine = None
_spotify_service = None


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

    app.register_blueprint(spotify_auth_bp)
    app.register_blueprint(spotify_data_bp, url_prefix="/api")
    app.register_blueprint(lastfm_auth_bp)
    app.register_blueprint(lastfm_data_bp, url_prefix="/api")
    app.register_blueprint(soulmate_bp, url_prefix="/api")
    app.register_blueprint(aesthetic_bp)
    app.register_blueprint(discover_bp)
    app.register_blueprint(music_profile_bp)
    app.register_blueprint(public_profile_bp)
    app.register_blueprint(pinterest_bp)
    app.register_blueprint(auralith_bp, url_prefix="/api")

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

    @app.after_request
    def _log_request(response):
        ms = round((time.time() - g.get("start", time.time())) * 1000, 1)
        logger.info(
            {
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "ms": ms,
                "ip": request.remote_addr,
            }
        )
        return response


def register_routes(app: Flask) -> None:
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
            },
            warnings=[{"code": "DATABASE_UNREACHABLE", "message": db_error}] if db_error else None,
        )

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
            return api_success({"token": token, "user_id": uid}, 201)
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
                stored = user["password_hash"]
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
                    return api_success({"token": token, "user_id": uid})
            return api_error("Invalid credentials", 401, code="INVALID_CREDENTIALS")
        except Exception as exc:
            logger.error({"event": "login_error", "error": str(exc)})
            return api_error("Login failed", 500, code="LOGIN_FAILED")

    @app.route("/api/map/generate", methods=["POST"])
    @require_auth
    def generate_map():
        similarity_engine = get_similarity_engine()
        recommendation_engine = get_recommendation_engine()
        if not similarity_engine or not recommendation_engine:
            return api_error("ML engine unavailable", 503, code="ML_ENGINE_UNAVAILABLE")

        songs = list(mongo.db.songs.find().limit(500))
        if not songs:
            return api_error("No songs in database", 404, code="SONG_CATALOG_EMPTY")

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
        return api_success({"message": "Map generated", "total_songs": len(songs)})

    @app.route("/api/map/data", methods=["GET"])
    def get_map_data():
        songs = list(mongo.db.songs.find({"map_coordinates": {"$exists": True}}))
        return api_success([serialize_doc(dict(song)) for song in songs])

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
            interactions = list(mongo.db.interactions.find({"user_id": ObjectId(user_id)}))
            songs = [serialize_doc(dict(song)) for song in mongo.db.songs.find()]
            profile = recommendation_engine.build_user_profile(interactions, songs)
            recs = recommendation_engine.hybrid_recommendation(user_id, profile, interactions, songs, 20)
            return api_success(recs)
        except Exception as exc:
            logger.error({"event": "recommendations_failed", "error": str(exc), "user_id": user_id})
            return api_success([], warnings=[{"code": "RECOMMENDATIONS_DEGRADED", "message": "Recommendation pipeline degraded"}])

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
        logger.error({"event": "unhandled_error", "error": str(error)})
        return api_error("Internal server error", 500, code="INTERNAL_SERVER_ERROR")


app = create_app()


if __name__ == "__main__":
    app.run(debug=Config.debug, port=Config.port)

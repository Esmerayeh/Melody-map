print("APP STARTING")

from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import Config
from middleware.auth import require_auth, optional_auth
from middleware.rate_limit import rate_limit
from utils.logger import logger
from bson import ObjectId
import bcrypt
import jwt
import time
from datetime import datetime, timedelta

print("IMPORTS FINISHED")

# ── Blueprint imports — these MUST succeed for routes to be reachable ──────────
from routes.spotify_auth import spotify_auth_bp
from routes.spotify_data import spotify_data_bp
from routes.lastfm_auth import lastfm_auth_bp
from routes.lastfm_data import lastfm_data_bp
from routes.soulmate import soulmate_bp, init_mongo as soulmate_init_mongo
from routes.aesthetic import aesthetic_bp
from routes.discover import discover_bp
from routes.music_profile import music_profile_bp
from routes.public_profile import public_profile_bp, init_mongo as public_profile_init_mongo
from routes.pinterest_aesthetic import pinterest_bp
from routes.auralith import auralith_bp

# ── ML engines — truly lazy: instantiated on first use, not at boot ───────────
_similarity_engine = None
_recommendation_engine = None
_spotify_service = None

def get_similarity_engine():
    global _similarity_engine
    if _similarity_engine is None:
        try:
            from ml.similarity_engine import MusicSimilarityEngine
            _similarity_engine = MusicSimilarityEngine(n_clusters=10)
            logger.info({'event': 'similarity_engine_loaded'})
        except Exception as e:
            logger.error({'event': 'similarity_engine_failed', 'err': str(e)})
    return _similarity_engine

def get_recommendation_engine():
    global _recommendation_engine
    if _recommendation_engine is None:
        try:
            from ml.recommendation_engine import RecommendationEngine
            _recommendation_engine = RecommendationEngine()
            logger.info({'event': 'recommendation_engine_loaded'})
        except Exception as e:
            logger.error({'event': 'recommendation_engine_failed', 'err': str(e)})
    return _recommendation_engine

def get_spotify_service():
    global _spotify_service
    if _spotify_service is None:
        try:
            from services.spotify_service import SpotifyService
            _spotify_service = SpotifyService()
            logger.info({'event': 'spotify_service_loaded'})
        except Exception as e:
            logger.error({'event': 'spotify_service_failed', 'err': str(e)})
    return _spotify_service

app = Flask(__name__)
app.config['MONGO_URI'] = Config.MONGODB_URI
app.config['SECRET_KEY'] = Config.SECRET_KEY

# Allow requests from the frontend domain.
# FRONTEND_URL is the single source of truth — set it in .env / Render env vars.
_cors_origins = [Config.FRONTEND_URL]
# Also allow localhost variants during local development
if 'localhost' in Config.FRONTEND_URL or '127.0.0.1' in Config.FRONTEND_URL:
    _cors_origins += ['http://localhost:3000', 'http://127.0.0.1:3000']
CORS(app, resources={r"/*": {"origins": _cors_origins}}, supports_credentials=True)

try:
    mongo = PyMongo(app, serverSelectionTimeoutMS=3000)
    logger.info({'event': 'mongo_connected'})
except Exception as e:
    logger.error({'event': 'mongo_init_failed', 'err': str(e)})
    raise

# ── Register blueprints ────────────────────────────────────────────────────────
app.register_blueprint(spotify_auth_bp)
app.register_blueprint(spotify_data_bp, url_prefix='/api')
app.register_blueprint(lastfm_auth_bp)
app.register_blueprint(lastfm_data_bp, url_prefix='/api')
soulmate_init_mongo(mongo)
app.register_blueprint(soulmate_bp, url_prefix='/api')
app.register_blueprint(aesthetic_bp)
app.register_blueprint(discover_bp)
app.register_blueprint(music_profile_bp)
public_profile_init_mongo(mongo)
app.register_blueprint(public_profile_bp)
app.register_blueprint(pinterest_bp)
app.register_blueprint(auralith_bp, url_prefix='/api')

# Confirm all blueprints registered — visible in Render logs
print("BLUEPRINTS REGISTERED")
print(app.url_map)
logger.info({'event': 'blueprints_registered', 'routes': [str(r) for r in app.url_map.iter_rules()]})


# ── Request logging ────────────────────────────────────────────────────────────
@app.before_request
def _start_timer():
    g.start = time.time()

@app.after_request
def _log_request(response):
    ms = round((time.time() - g.get('start', time.time())) * 1000, 1)
    logger.info({
        'method': request.method,
        'path':   request.path,
        'status': response.status_code,
        'ms':     ms,
        'ip':     request.remote_addr,
    })
    return response

# ── Helpers ────────────────────────────────────────────────────────────────────
def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

def validate_fields(data: dict, required: list[str]):
    missing = [f for f in required if not data.get(f)]
    return missing

# ── Root ───────────────────────────────────────────────────────────────────────
@app.route('/')
def root():
    return jsonify({'status': 'ok', 'service': 'melody-map-api'}), 200


# ── Health ─────────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    try:
        mongo.db.command('ping')
        db_ok = True
    except Exception as e:
        db_ok = False
        logger.warning({'event': 'health_db_unreachable', 'err': str(e)})
    return jsonify({
        'status': 'ok' if db_ok else 'degraded',
        'db':     'connected' if db_ok else 'unreachable',
        'ts':     datetime.utcnow().isoformat(),
    }), 200


# ── Auth ───────────────────────────────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def register():
    try:
        data = request.json or {}
        missing = validate_fields(data, ['email', 'password'])
        if missing:
            return jsonify({'error': f"Missing fields: {', '.join(missing)}"}), 400
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        if mongo.db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'Email already registered'}), 409

        hashed = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
        user = {
            'username':    data.get('username', data['email'].split('@')[0]),
            'email':       data['email'],
            'password_hash': hashed,
            'created_at':  datetime.utcnow(),
            'taste_profile': {},
            'playlists':   [],
        }
        result = mongo.db.users.insert_one(user)
        uid    = str(result.inserted_id)
        token  = jwt.encode({'user_id': uid, 'exp': datetime.utcnow() + timedelta(days=30)},
                            Config.SECRET_KEY, algorithm='HS256')
        logger.info({'event': 'register', 'user_id': uid})
        return jsonify({'token': token, 'user_id': uid}), 201
    except Exception as e:
        logger.error({'event': 'register_error', 'err': str(e)})
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def login():
    try:
        data = request.json or {}
        missing = validate_fields(data, ['email', 'password'])
        if missing:
            return jsonify({'error': f"Missing fields: {', '.join(missing)}"}), 400

        user = mongo.db.users.find_one({'email': data['email']})
        if user:
            stored = user['password_hash']
            if isinstance(stored, str):
                stored = stored.encode()
            if bcrypt.checkpw(data['password'].encode(), stored):
                uid   = str(user['_id'])
                token = jwt.encode({'user_id': uid, 'exp': datetime.utcnow() + timedelta(days=30)},
                                   Config.SECRET_KEY, algorithm='HS256')
                logger.info({'event': 'login', 'user_id': uid})
                return jsonify({'token': token, 'user_id': uid}), 200
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        logger.error({'event': 'login_error', 'err': str(e)})
        return jsonify({'error': 'Login failed'}), 500

# ── Map ────────────────────────────────────────────────────────────────────────
@app.route('/api/map/generate', methods=['POST'])
@require_auth
def generate_map():
    similarity_engine = get_similarity_engine()
    recommendation_engine = get_recommendation_engine()
    if not similarity_engine or not recommendation_engine:
        return jsonify({'error': 'ML engine unavailable'}), 503
    songs = list(mongo.db.songs.find().limit(500))
    if not songs:
        return jsonify({'error': 'No songs in database'}), 404
    songs_data = [serialize_doc(dict(s)) for s in songs]
    features   = similarity_engine.extract_features(songs_data)
    normalized = similarity_engine.normalize_features(features)
    clusters   = similarity_engine.cluster_songs(normalized)
    coords2d   = similarity_engine.reduce_dimensions_pca(normalized, 2)
    coords3d   = similarity_engine.reduce_dimensions_3d(normalized)
    for i, song in enumerate(songs):
        mongo.db.songs.update_one({'_id': song['_id']}, {'$set': {
            'cluster_id':      int(clusters[i]),
            'map_coordinates': {'x': float(coords2d[i][0]), 'y': float(coords2d[i][1])},
            'map_coords_3d':   {'x': float(coords3d[i][0]), 'y': float(coords3d[i][1]), 'z': float(coords3d[i][2])},
        }})
    recommendation_engine.fit_knn(songs_data)
    logger.info({'event': 'map_generated', 'songs': len(songs)})
    return jsonify({'message': 'Map generated', 'total_songs': len(songs)}), 200


@app.route('/api/map/data', methods=['GET'])
def get_map_data():
    songs = list(mongo.db.songs.find({'map_coordinates': {'$exists': True}}))
    return jsonify([serialize_doc(dict(s)) for s in songs]), 200


# ── Songs ──────────────────────────────────────────────────────────────────────
@app.route('/api/songs/search', methods=['GET'])
@rate_limit(max_requests=30, window_seconds=60)
def search_songs():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([]), 200
    songs = list(mongo.db.songs.find({
        '$or': [
            {'title':  {'$regex': q, '$options': 'i'}},
            {'artist': {'$regex': q, '$options': 'i'}},
            {'album':  {'$regex': q, '$options': 'i'}},
        ]
    }).limit(20))
    return jsonify([serialize_doc(dict(s)) for s in songs]), 200


@app.route('/api/songs/<song_id>/similar', methods=['GET'])
def get_similar_songs(song_id):
    similarity_engine = get_similarity_engine()
    if not similarity_engine:
        return jsonify({'error': 'ML engine unavailable'}), 503
    try:
        song = mongo.db.songs.find_one({'_id': ObjectId(song_id)})
    except Exception:
        return jsonify({'error': 'Invalid song id'}), 400
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    all_songs  = list(mongo.db.songs.find())
    songs_data = [serialize_doc(dict(s)) for s in all_songs]
    features   = similarity_engine.extract_features(songs_data)
    idx = next((i for i, s in enumerate(all_songs) if s['_id'] == song['_id']), None)
    if idx is None:
        return jsonify([]), 200
    similar_idx, _ = similarity_engine.find_similar_songs(features[idx], features, top_k=10)
    return jsonify([serialize_doc(dict(all_songs[i])) for i in similar_idx]), 200


# ── Playlists ──────────────────────────────────────────────────────────────────
@app.route('/api/playlists/generate', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def generate_playlist():
    recommendation_engine = get_recommendation_engine()
    if not recommendation_engine:
        return jsonify({'error': 'ML engine unavailable'}), 503
    data = request.json or {}
    mood = data.get('mood', '').strip()
    if not mood:
        return jsonify({'error': 'mood required'}), 400
    songs          = list(mongo.db.songs.find())
    playlist_songs = recommendation_engine.generate_mood_playlist(mood, [serialize_doc(dict(s)) for s in songs], 20)
    playlist = {
        'name':           f'{mood.capitalize()} Vibes',
        'description':    f'AI-generated {mood} playlist',
        'songs':          [s.get('_id') for s in playlist_songs],
        'mood':           mood,
        'created_at':     datetime.utcnow(),
        'generated_by_ai': True,
    }
    result = mongo.db.playlists.insert_one(playlist)
    return jsonify({'playlist_id': str(result.inserted_id), 'songs': playlist_songs}), 201


@app.route('/api/playlists/<playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    try:
        pl = mongo.db.playlists.find_one({'_id': ObjectId(playlist_id)})
    except Exception:
        return jsonify({'error': 'Invalid id'}), 400
    if not pl:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(serialize_doc(dict(pl))), 200


# ── Recommendations ────────────────────────────────────────────────────────────
@app.route('/api/recommendations/<user_id>', methods=['GET'])
@rate_limit(max_requests=30, window_seconds=60)
def get_recommendations(user_id):
    try:
        recommendation_engine = get_recommendation_engine()
        interactions = list(mongo.db.interactions.find({'user_id': ObjectId(user_id)}))
        songs        = [serialize_doc(dict(s)) for s in mongo.db.songs.find()]
        profile      = recommendation_engine.build_user_profile(interactions, songs)
        recs         = recommendation_engine.hybrid_recommendation(user_id, profile, interactions, songs, 20)
        return jsonify(recs), 200
    except Exception as e:
        logger.error({'event': 'recs_error', 'err': str(e)})
        return jsonify([]), 200


# ── Interactions ───────────────────────────────────────────────────────────────
@app.route('/api/interactions', methods=['POST'])
@require_auth
def record_interaction():
    data = request.json or {}
    missing = validate_fields(data, ['song_id', 'interaction_type'])
    if missing:
        return jsonify({'error': f"Missing: {', '.join(missing)}"}), 400
    allowed = {'like', 'play', 'skip', 'save'}
    if data['interaction_type'] not in allowed:
        return jsonify({'error': f"interaction_type must be one of {allowed}"}), 400
    mongo.db.interactions.insert_one({
        'user_id':          ObjectId(g.user_id),
        'song_id':          data['song_id'],
        'interaction_type': data['interaction_type'],
        'timestamp':        datetime.utcnow(),
    })
    return jsonify({'ok': True}), 201


# ── Error handlers ─────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(e):
    logger.error({'event': 'unhandled_error', 'err': str(e)})
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=Config.PORT)

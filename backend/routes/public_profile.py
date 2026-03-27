"""
Public Profile route
--------------------
GET /api/public-profile/<public_slug>

Returns a sanitised taste profile for any user who has synced their
soulmate profile.  No authentication required — this is intentionally
public so that invite links work without the viewer being logged in.
"""

from flask import Blueprint, jsonify
from datetime import datetime, timezone
from middleware.rate_limit import rate_limit
from utils.logger import logger

public_profile_bp = Blueprint('public_profile', __name__)

# Injected by app.py
_mongo = None

def init_mongo(mongo_instance):
    global _mongo
    _mongo = mongo_instance


@public_profile_bp.route('/api/public-profile/<identifier>', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def get_public_profile(identifier: str):
    """
    Look up a taste_profile by public_slug, with limited legacy fallback.
    Returns a safe subset: topArtists, topTracks, genres, audioFeatures.
    """
    if _mongo is None:
        return jsonify({'error': 'Database not initialised'}), 500

    doc = _mongo.db.taste_profiles.find_one({'public_slug': identifier})
    if not doc:
        doc = _mongo.db.taste_profiles.find_one({'username': identifier})
    if not doc:
        doc = _mongo.db.taste_profiles.find_one({'user_id': identifier})
    if not doc:
        return jsonify({'error': 'Profile not found'}), 404

    # Normalise to the same shape the frontend expects from /api/music-profile
    top_artists_raw = doc.get('top_artists', [])
    top_artists = []
    for a in top_artists_raw:
        if isinstance(a, str):
            top_artists.append({'name': a, 'genres': [], 'popularity': 50})
        elif isinstance(a, dict):
            top_artists.append(a)

    top_tracks_raw = doc.get('top_tracks', [])
    top_tracks = []
    for t in top_tracks_raw:
        if isinstance(t, str):
            top_tracks.append({'title': t, 'artist': ''})
        elif isinstance(t, dict):
            top_tracks.append(t)

    genres_raw = doc.get('genres', [])
    genres = []
    for g in genres_raw:
        if isinstance(g, str):
            genres.append({'genre': g, 'count': 1})
        elif isinstance(g, dict):
            genres.append(g)

    return jsonify({
        'profileSchemaVersion': '2026-03-public-profile-v2',
        'username':             doc.get('username', identifier),
        'displayName':          doc.get('username', identifier),
        'publicSlug':           doc.get('public_slug'),
        'avatar':               doc.get('avatar'),
        'topArtists':           top_artists,
        'topTracks':            top_tracks,
        'genres':               genres,
        'audioFeatures':        doc.get('audio_features', {}),
        'syncedAt':             doc.get('updated_at').replace(tzinfo=timezone.utc).isoformat() if doc.get('updated_at') else None,
        'dataQuality':          doc.get('data_quality', {}),
        'confidence':           doc.get('confidence', {}),
        'soulmateReadiness':    doc.get('soulmate_readiness', {}),
        'identityReadiness':    doc.get('identity_readiness', {}),
    }), 200

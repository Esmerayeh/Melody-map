"""
Music Profile route
-------------------
GET  /api/music-profile   — build and return a complete music profile
                            from the user's Spotify data.

Query params:
  time_range  short_term | medium_term (default) | long_term
  limit       1–50 (default 50)

Headers:
  X-Spotify-Token   <spotify_access_token>

Response: see music_profile_builder.build_music_profile()
"""

from flask import Blueprint, request, jsonify
from middleware.rate_limit import rate_limit
from services.music_profile_builder import build_music_profile

music_profile_bp = Blueprint('music_profile', __name__)


@music_profile_bp.route('/api/music-profile', methods=['GET'])
@rate_limit(max_requests=30, window_seconds=60)
def get_music_profile():
    token = (
        request.headers.get('X-Spotify-Token') or
        request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    )
    if not token:
        return jsonify({'error': 'Spotify token required (X-Spotify-Token header)'}), 401

    time_range = request.args.get('time_range', 'medium_term')
    if time_range not in ('short_term', 'medium_term', 'long_term'):
        time_range = 'medium_term'

    try:
        limit = min(int(request.args.get('limit', 50)), 50)
    except (ValueError, TypeError):
        limit = 50

    try:
        profile = build_music_profile(
            spotify_token=token,
            time_range=time_range,
            limit=limit,
        )
        return jsonify(profile), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

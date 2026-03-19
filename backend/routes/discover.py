"""
Discover routes
---------------
POST /api/discover/playlists   — generate personalized playlist concepts
GET  /api/discover/playlists   — same, via query params
"""

from flask import Blueprint, request, jsonify
from middleware.rate_limit import rate_limit
from ml.discover_engine import discover_engine

discover_bp = Blueprint('discover', __name__)


def _parse_profile(data: dict) -> tuple[list, float, float]:
    genres  = data.get('genres', [])
    energy  = float(data.get('energy', 0.5))
    valence = float(data.get('valence', 0.5))
    # Clamp
    energy  = max(0.0, min(1.0, energy))
    valence = max(0.0, min(1.0, valence))
    return genres, energy, valence


@discover_bp.route('/api/discover/playlists', methods=['POST', 'GET'])
@rate_limit(max_requests=30, window_seconds=60)
def get_playlists():
    if request.method == 'POST':
        data = request.json or {}
    else:
        data = request.args.to_dict()
        raw_genres = data.get('genres', '')
        data['genres'] = [g.strip() for g in raw_genres.split(',') if g.strip()] if raw_genres else []

    genres, energy, valence = _parse_profile(data)
    n          = min(int(data.get('n', 6)), 10)
    seed       = int(data.get('seed', 0))
    serendipity = str(data.get('serendipity', 'false')).lower() == 'true'

    playlists = discover_engine.generate_playlists(
        genres=genres,
        energy=energy,
        valence=valence,
        n_playlists=n,
        seed=seed,
        serendipity=serendipity,
    )
    return jsonify(playlists), 200

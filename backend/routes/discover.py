"""
Discover routes
---------------
POST /api/discover/playlists   — generate personalized playlist concepts
GET  /api/discover/playlists   — same, via query params
"""

from flask import Blueprint, request, jsonify
from middleware.rate_limit import rate_limit
from ml.discover_engine import discover_engine
from services.spotify_recommendation_bridge import spotify_recommendation_bridge
from utils.provider_cookies import spotify_context_from_request

discover_bp = Blueprint('discover', __name__)


def _parse_profile(data: dict) -> tuple[list, float, float]:
    genres  = data.get('genres', [])
    energy  = float(data.get('energy', 0.5))
    valence = float(data.get('valence', 0.5))
    # Clamp
    energy  = max(0.0, min(1.0, energy))
    valence = max(0.0, min(1.0, valence))
    return genres, energy, valence


def _spotify_token_from_request() -> str:
    header_token = request.headers.get('X-Spotify-Token') or request.headers.get('Authorization', '')
    cookie_token, _, _ = spotify_context_from_request(request)
    return header_token or cookie_token or ''


def _truthy(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() not in {'0', 'false', 'no', 'off'}


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
    grounded = str(data.get('grounded', 'true')).lower() != 'false'
    include_live_tracks = _truthy(data.get('include_live_tracks', data.get('includeLiveTracks')), default=False)

    playlists = discover_engine.generate_playlists(
        genres=genres,
        energy=energy,
        valence=valence,
        n_playlists=n,
        seed=seed,
        serendipity=serendipity,
        grounded=grounded,
    )
    if include_live_tracks:
        profile_context = data.get('profile') if isinstance(data.get('profile'), dict) else data
        explicit_seeds = {
            'seedArtists': data.get('seedArtists') or data.get('seed_artists'),
            'seedTracks': data.get('seedTracks') or data.get('seed_tracks'),
            'seedGenres': data.get('seedGenres') or data.get('seed_genres'),
        }
        playlists = spotify_recommendation_bridge.attach_to_concepts(
            _spotify_token_from_request(),
            playlists,
            profile=profile_context,
            explicit_seeds=explicit_seeds,
            limit_per_concept=min(max(int(data.get('tracks_per_playlist', 4)), 1), 8),
        )
    return jsonify(playlists), 200

"""
Proxy endpoints that call Spotify Web API on behalf of the frontend.
All routes expect:  Authorization: Bearer <spotify_access_token>
"""

import requests
from flask import Blueprint, jsonify, request

spotify_data_bp = Blueprint('spotify_data', __name__)

SPOTIFY_API = 'https://api.spotify.com/v1'


def _spotify_headers():
    """Extract Spotify token from incoming request and build headers."""
    auth = request.headers.get('X-Spotify-Token') or request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '').strip()
    if not token:
        return None, jsonify({'error': 'Spotify token missing'}), 401
    return {'Authorization': f'Bearer {token}'}, None, None


def _get(path, params=None):
    """Make a GET request to Spotify API, return (data, error_response)."""
    headers, err_resp, status = _spotify_headers()
    if err_resp:
        return None, (err_resp, status)
    try:
        resp = requests.get(f"{SPOTIFY_API}{path}", headers=headers, params=params, timeout=10)
        if resp.status_code == 401:
            return None, (jsonify({'error': 'Spotify token expired', 'code': 'TOKEN_EXPIRED'}), 401)
        resp.raise_for_status()
        return resp.json(), None
    except requests.RequestException as e:
        return None, (jsonify({'error': str(e)}), 500)


@spotify_data_bp.route('/spotify/me')
def get_profile():
    """Get current user's Spotify profile."""
    data, err = _get('/me')
    if err:
        return err
    return jsonify({
        'id':          data.get('id'),
        'name':        data.get('display_name'),
        'email':       data.get('email'),
        'image':       data['images'][0]['url'] if data.get('images') else None,
        'country':     data.get('country'),
        'product':     data.get('product'),
        'followers':   data.get('followers', {}).get('total', 0),
    })


@spotify_data_bp.route('/spotify/top-tracks')
def get_top_tracks():
    """Get user's top tracks (short/medium/long term)."""
    time_range = request.args.get('time_range', 'medium_term')
    limit      = min(int(request.args.get('limit', 20)), 50)

    data, err = _get('/me/top/tracks', {'time_range': time_range, 'limit': limit})
    if err:
        return err

    tracks = []
    for item in data.get('items', []):
        tracks.append({
            'id':         item['id'],
            'title':      item['name'],
            'artist':     item['artists'][0]['name'],
            'artists':    [a['name'] for a in item['artists']],
            'album':      item['album']['name'],
            'album_art':  item['album']['images'][0]['url'] if item['album']['images'] else None,
            'preview_url':item.get('preview_url'),
            'popularity': item.get('popularity', 0),
            'duration_ms':item.get('duration_ms', 0),
            'spotify_url':item['external_urls'].get('spotify'),
        })
    return jsonify(tracks)


@spotify_data_bp.route('/spotify/top-artists')
def get_top_artists():
    """Get user's top artists."""
    time_range = request.args.get('time_range', 'medium_term')
    limit      = min(int(request.args.get('limit', 20)), 50)

    data, err = _get('/me/top/artists', {'time_range': time_range, 'limit': limit})
    if err:
        return err

    artists = []
    for item in data.get('items', []):
        artists.append({
            'id':         item['id'],
            'name':       item['name'],
            'genres':     item.get('genres', []),
            'popularity': item.get('popularity', 0),
            'followers':  item.get('followers', {}).get('total', 0),
            'image':      item['images'][0]['url'] if item.get('images') else None,
            'spotify_url':item['external_urls'].get('spotify'),
        })
    return jsonify(artists)


@spotify_data_bp.route('/spotify/playlists')
def get_playlists():
    """Get user's playlists."""
    limit = min(int(request.args.get('limit', 20)), 50)
    data, err = _get('/me/playlists', {'limit': limit})
    if err:
        return err

    playlists = []
    for item in data.get('items', []):
        if not item:
            continue
        playlists.append({
            'id':          item['id'],
            'name':        item['name'],
            'description': item.get('description', ''),
            'tracks':      item['tracks']['total'],
            'image':       item['images'][0]['url'] if item.get('images') else None,
            'public':      item.get('public', False),
            'spotify_url': item['external_urls'].get('spotify'),
        })
    return jsonify(playlists)


@spotify_data_bp.route('/spotify/audio-features', methods=['POST'])
def get_audio_features():
    """Get audio features for a list of track IDs."""
    track_ids = request.json.get('track_ids', [])
    if not track_ids:
        return jsonify([])

    # Spotify allows max 100 IDs per request
    ids_str = ','.join(track_ids[:100])
    data, err = _get('/audio-features', {'ids': ids_str})
    if err:
        return err

    features = []
    for f in data.get('audio_features', []):
        if not f:
            continue
        features.append({
            'id':               f['id'],
            'tempo':            f.get('tempo', 0),
            'energy':           f.get('energy', 0),
            'danceability':     f.get('danceability', 0),
            'valence':          f.get('valence', 0),
            'acousticness':     f.get('acousticness', 0),
            'instrumentalness': f.get('instrumentalness', 0),
            'loudness':         f.get('loudness', 0),
            'speechiness':      f.get('speechiness', 0),
        })
    return jsonify(features)


@spotify_data_bp.route('/spotify/search')
def search_tracks():
    """Search Spotify for tracks by query string."""
    q     = request.args.get('q', '').strip()
    limit = min(int(request.args.get('limit', 10)), 50)
    if not q:
        return jsonify({'tracks': {'items': []}})

    data, err = _get('/search', {'q': q, 'type': 'track', 'limit': limit})
    if err:
        return err

    tracks = []
    for item in data.get('tracks', {}).get('items', []):
        tracks.append({
            'id':          item['id'],
            'name':        item['name'],
            'artists':     [{'name': a['name'], 'id': a['id']} for a in item['artists']],
            'album': {
                'name':         item['album']['name'],
                'images':       item['album'].get('images', []),
                'release_date': item['album'].get('release_date', ''),
            },
            'popularity':    item.get('popularity', 0),
            'preview_url':   item.get('preview_url'),
            'external_urls': item.get('external_urls', {}),
            'duration_ms':   item.get('duration_ms', 0),
        })
    return jsonify({'tracks': {'items': tracks}})

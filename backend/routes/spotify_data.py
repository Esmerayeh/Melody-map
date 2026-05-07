"""Proxy endpoints that call Spotify Web API on behalf of the frontend."""

from flask import Blueprint, jsonify, request

from services.spotify_proxy_service import spotify_proxy_service
from utils.api import api_error
from utils.provider_cookies import spotify_context_from_request

spotify_data_bp = Blueprint('spotify_data', __name__)

def _token_from_request() -> str:
    header_token = request.headers.get('X-Spotify-Token') or request.headers.get('Authorization', '')
    cookie_token, _, _ = spotify_context_from_request(request)
    return header_token or cookie_token or ''


def _get(path, params=None):
    result = spotify_proxy_service.get(_token_from_request(), path, params)
    if not result.ok:
        return None, api_error(
            result.error_message or 'Spotify request failed',
            result.status,
            code=result.error_code,
            details=result.data,
        )
    return result.data or {}, None


@spotify_data_bp.route('/spotify/me')
def get_profile():
    data, err = _get('/me')
    if err:
        return err
    return jsonify({
        'id':        data.get('id'),
        'name':      data.get('display_name'),
        'email':     data.get('email'),
        'image':     data['images'][0]['url'] if data.get('images') else None,
        'country':   data.get('country'),
        'product':   data.get('product'),
        'followers': data.get('followers', {}).get('total', 0),
    })


@spotify_data_bp.route('/spotify/top-tracks')
def get_top_tracks():
    time_range = request.args.get('time_range', 'medium_term')
    limit      = min(int(request.args.get('limit', 20)), 50)
    data, err  = _get('/me/top/tracks', {'time_range': time_range, 'limit': limit})
    if err:
        return err
    tracks = []
    for item in data.get('items', []):
        tracks.append({
            'id':          item['id'],
            'title':       item['name'],
            'artist':      item['artists'][0]['name'],
            'artists':     [a['name'] for a in item['artists']],
            'album':       item['album']['name'],
            'album_art':   item['album']['images'][0]['url'] if item['album']['images'] else None,
            'preview_url': item.get('preview_url'),
            'popularity':  item.get('popularity', 0),
            'duration_ms': item.get('duration_ms', 0),
            'spotify_url': item['external_urls'].get('spotify'),
        })
    return jsonify(tracks)


@spotify_data_bp.route('/spotify/top-artists')
def get_top_artists():
    time_range = request.args.get('time_range', 'medium_term')
    limit      = min(int(request.args.get('limit', 20)), 50)
    data, err  = _get('/me/top/artists', {'time_range': time_range, 'limit': limit})
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
    limit     = min(int(request.args.get('limit', 20)), 50)
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
    payload = request.get_json(silent=True) or {}
    track_ids = payload.get('track_ids', [])
    if not track_ids:
        return jsonify([])
    ids_str   = ','.join(track_ids[:100])
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


@spotify_data_bp.route('/spotify/recently-played')
def get_recently_played():
    """Get user's recently played tracks (deduped)."""
    limit     = min(int(request.args.get('limit', 50)), 50)
    data, err = _get('/me/player/recently-played', {'limit': limit})
    if err:
        return err
    tracks, seen = [], set()
    for item in data.get('items', []):
        track = item.get('track')
        if not track or track['id'] in seen:
            continue
        seen.add(track['id'])
        tracks.append({
            'id':          track['id'],
            'title':       track['name'],
            'artist':      track['artists'][0]['name'],
            'artists':     [a['name'] for a in track['artists']],
            'album':       track['album']['name'],
            'album_art':   track['album']['images'][0]['url'] if track['album']['images'] else None,
            'preview_url': track.get('preview_url'),
            'popularity':  track.get('popularity', 0),
            'duration_ms': track.get('duration_ms', 0),
            'spotify_url': track['external_urls'].get('spotify'),
            'played_at':   item.get('played_at'),
        })
    return jsonify(tracks)


@spotify_data_bp.route('/spotify/saved-tracks')
def get_saved_tracks():
    """Get user's saved (liked) tracks."""
    limit     = min(int(request.args.get('limit', 50)), 50)
    data, err = _get('/me/tracks', {'limit': limit})
    if err:
        return err
    tracks = []
    for item in data.get('items', []):
        track = item.get('track')
        if not track:
            continue
        tracks.append({
            'id':          track['id'],
            'title':       track['name'],
            'artist':      track['artists'][0]['name'],
            'artists':     [a['name'] for a in track['artists']],
            'album':       track['album']['name'],
            'album_art':   track['album']['images'][0]['url'] if track['album']['images'] else None,
            'preview_url': track.get('preview_url'),
            'popularity':  track.get('popularity', 0),
            'duration_ms': track.get('duration_ms', 0),
            'spotify_url': track['external_urls'].get('spotify'),
            'added_at':    item.get('added_at'),
        })
    return jsonify(tracks)


@spotify_data_bp.route('/spotify/recommendations')
def get_recommendations():
    """Get Spotify recommendations seeded by top artists/tracks/genres."""
    seed_artists = request.args.getlist('seed_artists') or []
    seed_tracks  = request.args.getlist('seed_tracks')  or []
    seed_genres  = request.args.getlist('seed_genres')  or []
    limit        = min(int(request.args.get('limit', 25)), 100)

    if not seed_artists and not seed_tracks and not seed_genres:
        return jsonify({'error': 'At least one seed required'}), 400

    # Spotify requires total seeds <= 5
    params = {'limit': limit}
    if seed_artists: params['seed_artists'] = ','.join(seed_artists[:2])
    if seed_tracks:  params['seed_tracks']  = ','.join(seed_tracks[:2])
    if seed_genres:  params['seed_genres']  = ','.join(seed_genres[:1])

    for key in ['target_energy', 'target_valence', 'target_danceability',
                'min_energy', 'max_energy', 'min_valence', 'max_valence']:
        val = request.args.get(key)
        if val is not None:
            params[key] = val

    data, err = _get('/recommendations', params)
    if err:
        return err

    tracks = []
    for item in data.get('tracks', []):
        tracks.append({
            'id':          item['id'],
            'title':       item['name'],
            'artist':      item['artists'][0]['name'],
            'artists':     [{'name': a['name'], 'id': a['id']} for a in item['artists']],
            'album':       item['album']['name'],
            'album_art':   item['album']['images'][0]['url'] if item['album']['images'] else None,
            'preview_url': item.get('preview_url'),
            'popularity':  item.get('popularity', 0),
            'duration_ms': item.get('duration_ms', 0),
            'spotify_url': item['external_urls'].get('spotify'),
        })
    return jsonify(tracks)


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

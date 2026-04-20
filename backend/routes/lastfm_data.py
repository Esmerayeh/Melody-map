"""Last.fm data proxy endpoints backed by HTTP-only provider cookies."""

import requests
from flask import Blueprint, request

from utils.api import api_error, api_success_legacy
from utils.provider_cookies import LASTFM_SESSION_COOKIE, LASTFM_USERNAME_COOKIE, get_cookie

lastfm_data_bp = Blueprint('lastfm_data', __name__)

LASTFM_API = 'https://ws.audioscrobbler.com/2.0/'


def _ctx():
    """Extract session key, username, and api_key from provider cookies."""
    from config import Config
    session = get_cookie(request, LASTFM_SESSION_COOKIE) or ''
    username = get_cookie(request, LASTFM_USERNAME_COOKIE) or ''
    return session, username, Config.lastfm_api_key


def _get(method, extra=None):
    """GET from Last.fm API, return (data, error_response)."""
    session, username, api_key = _ctx()
    if not username:
        return None, api_error('Last.fm username missing', 401, code='LASTFM_USERNAME_MISSING')

    params = {
        'method':  method,
        'user':    username,
        'api_key': api_key,
        'format':  'json',
        'limit':   50,
    }
    if extra:
        params.update(extra)

    try:
        resp = requests.get(LASTFM_API, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if 'error' in data:
            return None, api_error(data.get('message', 'Last.fm error'), 400, code=f"LASTFM_{data['error']}")
        return data, None
    except requests.RequestException as e:
        return None, api_error('Last.fm request failed', 502, code='LASTFM_REQUEST_FAILED', details={'reason': str(e)})


def _success(payload):
    return api_success_legacy(payload)


@lastfm_data_bp.route('/lastfm/me')
def get_profile():
    """Get Last.fm user profile."""
    data, err = _get('user.getInfo')
    if err:
        return err
    u = data.get('user', {})
    return _success({
        'id':        u.get('name'),
        'name':      u.get('realname') or u.get('name'),
        'username':  u.get('name'),
        'image':     next((i['#text'] for i in reversed(u.get('image', [])) if i['#text']), None),
        'country':   u.get('country'),
        'playcount': u.get('playcount'),
        'registered': u.get('registered', {}).get('#text'),
        'provider':  'lastfm',
    })


@lastfm_data_bp.route('/lastfm/top-tracks')
def get_top_tracks():
    """Get user's top tracks."""
    period = request.args.get('period', 'overall')  # overall | 7day | 1month | 3month | 6month | 12month
    limit  = min(int(request.args.get('limit', 20)), 50)

    data, err = _get('user.getTopTracks', {'period': period, 'limit': limit})
    if err:
        return err

    tracks = []
    for item in data.get('toptracks', {}).get('track', []):
        image = next((i['#text'] for i in reversed(item.get('image', [])) if i['#text']), None)
        tracks.append({
            'id':         item.get('mbid') or item.get('url', '').split('/')[-1],
            'title':      item.get('name'),
            'artist':     item.get('artist', {}).get('name'),
            'album':      None,
            'album_art':  image,
            'playcount':  int(item.get('playcount', 0)),
            'popularity': min(int(item.get('playcount', 0)) // 10, 100),
            'spotify_url': None,
            'lastfm_url': item.get('url'),
        })
    return _success(tracks)


@lastfm_data_bp.route('/lastfm/top-artists')
def get_top_artists():
    """Get user's top artists."""
    period = request.args.get('period', 'overall')
    limit  = min(int(request.args.get('limit', 20)), 50)

    data, err = _get('user.getTopArtists', {'period': period, 'limit': limit})
    if err:
        return err

    artists = []
    for item in data.get('topartists', {}).get('artist', []):
        image = next((i['#text'] for i in reversed(item.get('image', [])) if i['#text']), None)
        artists.append({
            'id':         item.get('mbid') or item.get('name'),
            'name':       item.get('name'),
            'genres':     [],   # populated via artist.getTopTags if needed
            'playcount':  int(item.get('playcount', 0)),
            'popularity': min(int(item.get('playcount', 0)) // 10, 100),
            'image':      image,
            'lastfm_url': item.get('url'),
        })
    return _success(artists)


@lastfm_data_bp.route('/lastfm/recent-tracks')
def get_recent_tracks():
    """Get user's recently played tracks."""
    limit = min(int(request.args.get('limit', 20)), 50)
    data, err = _get('user.getRecentTracks', {'limit': limit})
    if err:
        return err

    tracks = []
    for item in data.get('recenttracks', {}).get('track', []):
        image = next((i['#text'] for i in reversed(item.get('image', [])) if i['#text']), None)
        tracks.append({
            'id':        item.get('mbid') or item.get('url', '').split('/')[-1],
            'title':     item.get('name'),
            'artist':    item.get('artist', {}).get('#text'),
            'album':     item.get('album', {}).get('#text'),
            'album_art': image,
            'now_playing': bool(item.get('@attr', {}).get('nowplaying')),
            'lastfm_url': item.get('url'),
        })
    return _success(tracks)


@lastfm_data_bp.route('/lastfm/similar-artists')
def get_similar_artists():
    """Get similar artists for a given artist name."""
    artist = request.args.get('artist', '')
    if not artist:
        return api_error('artist param required', 400, code='ARTIST_PARAM_REQUIRED')

    _, _, api_key = _ctx()
    try:
        resp = requests.get(LASTFM_API, params={
            'method':  'artist.getSimilar',
            'artist':  artist,
            'api_key': api_key,
            'format':  'json',
            'limit':   10,
        }, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return api_error('Last.fm request failed', 502, code='LASTFM_REQUEST_FAILED', details={'reason': str(e)})

    similar = []
    for item in data.get('similarartists', {}).get('artist', []):
        image = next((i['#text'] for i in reversed(item.get('image', [])) if i['#text']), None)
        similar.append({
            'name':  item.get('name'),
            'match': float(item.get('match', 0)),
            'image': image,
            'lastfm_url': item.get('url'),
        })
    return _success(similar)


@lastfm_data_bp.route('/lastfm/artist-tags')
def get_artist_tags():
    """Get top tags (genres) for an artist."""
    artist = request.args.get('artist', '')
    if not artist:
        return api_error('artist param required', 400, code='ARTIST_PARAM_REQUIRED')

    _, _, api_key = _ctx()
    try:
        resp = requests.get(LASTFM_API, params={
            'method':  'artist.getTopTags',
            'artist':  artist,
            'api_key': api_key,
            'format':  'json',
        }, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return api_error('Last.fm request failed', 502, code='LASTFM_REQUEST_FAILED', details={'reason': str(e)})

    tags = [t['name'] for t in data.get('toptags', {}).get('tag', [])[:5]]
    return _success(tags)

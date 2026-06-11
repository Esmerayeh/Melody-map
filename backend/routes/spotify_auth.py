"""Spotify OAuth routes with short-lived browser-safe exchange codes."""

from __future__ import annotations

import base64
import secrets
import threading
import time
from datetime import datetime, timedelta

import jwt
import requests
from flask import Blueprint, current_app, redirect, request

from config import Config
from utils.api import api_error, api_success
from utils.auth_cookies import set_auth_cookie
from utils.logger import logger
from utils.provider_cookies import clear_spotify_cookies, set_spotify_cookies

spotify_auth_bp = Blueprint('spotify_auth', __name__)

SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
TOKEN_EXCHANGE_TTL = 300  # 5 min — absorbs Render free-tier cold start (was 120s)
_token_exchange_cache: dict[str, dict] = {}
# Collapse refresh stampedes: bootstrap is called many times in a burst on a
# page load, and each self-heal would otherwise mint a NEW access token, rotating
# the token every request (which broke the token-keyed profile cache and drove a
# refetch storm). Cache the refreshed token briefly so concurrent/rapid bootstraps
# reuse one fresh token instead of hammering Spotify and rotating on every call.
_REFRESH_CACHE_TTL = 45
_refresh_cache: dict[str, tuple[float, dict]] = {}
_refresh_lock = threading.Lock()
_mongo = None

SCOPES = ' '.join([
    'user-read-email',
    'user-read-private',
    'user-top-read',
    'playlist-read-private',
    'user-library-read',
    'user-read-recently-played',
])


def init_mongo(mongo_instance):
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.users.create_index('spotify_user_id', unique=True, sparse=True)
    except Exception:
        pass


def _basic_auth_header():
    creds = f"{Config.spotify_client_id}:{Config.spotify_client_secret}"
    encoded = base64.b64encode(creds.encode()).decode()
    return f"Basic {encoded}"


def _store_exchange_payload(payload: dict) -> str:
    code = secrets.token_urlsafe(24)
    _token_exchange_cache[code] = {
        'payload': payload,
        'expires_at': time.time() + TOKEN_EXCHANGE_TTL,
    }
    return code


def _consume_exchange_payload(code: str | None):
    if not code:
        return None
    entry = _token_exchange_cache.pop(code, None)
    if not entry or entry['expires_at'] < time.time():
        return None
    return entry['payload']


def _spotify_profile(access_token: str) -> dict | None:
    try:
        response = requests.get(
            'https://api.spotify.com/v1/me',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10,
        )
        if not response.ok:
            logger.warning({'event': 'spotify_profile_fetch_failed', 'status': response.status_code, 'body': response.text[:400]})
            return None
        return response.json()
    except requests.RequestException as exc:
        logger.error({'event': 'spotify_profile_fetch_exception', 'error': str(exc)})
        return None


def _display_name(profile: dict) -> str:
    spotify_id = str(profile.get('id') or '').strip()
    email = str(profile.get('email') or '').strip()
    display = str(profile.get('display_name') or '').strip()
    if display:
        return display
    if email:
        return email.split('@')[0]
    return f'spotify-{spotify_id[-6:]}' if spotify_id else 'spotify-listener'


def _profile_image(profile: dict) -> str | None:
    images = profile.get('images') or []
    first = images[0] if isinstance(images, list) and images else None
    return first.get('url') if isinstance(first, dict) else None


def _upsert_spotify_user(profile: dict) -> str | None:
    if _mongo is None:
        return None

    spotify_id = str(profile.get('id') or '').strip()
    if not spotify_id:
        return None

    email = str(profile.get('email') or '').strip() or None
    username = _display_name(profile)
    now = datetime.utcnow()
    existing = _mongo.db.users.find_one({'spotify_user_id': spotify_id})
    if not existing and email:
        existing = _mongo.db.users.find_one({'email': email})

    provider_payload = {
        'spotify_user_id': spotify_id,
        'spotify_display_name': username,
        'spotify_image': _profile_image(profile),
        'spotify_country': profile.get('country'),
        'spotify_product': profile.get('product'),
        'auth_provider': 'spotify',
        'updated_at': now,
    }

    if existing:
        user_id = str(existing['_id'])
        update = {**provider_payload}
        if not existing.get('username'):
            update['username'] = username
        if email and not existing.get('email'):
            update['email'] = email
        _mongo.db.users.update_one({'_id': existing['_id']}, {'$set': update})
        return user_id

    document = {
        'username': username,
        'email': email or f'spotify-{spotify_id}@spotify.local',
        'password_hash': None,
        'created_at': now,
        'taste_profile': {},
        'playlists': [],
        **provider_payload,
    }
    result = _mongo.db.users.insert_one(document)
    return str(result.inserted_id)


def _session_token_for_user(user_id: str) -> str:
    return jwt.encode(
        {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=30)},
        current_app.config['SECRET_KEY'],
        algorithm='HS256',
    )


def create_spotify_app_session(access_token: str) -> dict | None:
    spotify_user = _spotify_profile(access_token)
    if not spotify_user:
        return None
    user_id = _upsert_spotify_user(spotify_user)
    if not user_id:
        return None
    return {
        'user_id': user_id,
        'token': _session_token_for_user(user_id),
        'spotify_user_id': spotify_user.get('id'),
        'display_name': _display_name(spotify_user),
    }


@spotify_auth_bp.route('/auth/spotify/login')
def spotify_login():
    if not Config.spotify_credentials_available:
        return api_error('Spotify OAuth is not configured', 503, code='SPOTIFY_OAUTH_UNAVAILABLE')

    params = {
        'client_id': Config.spotify_client_id,
        'response_type': 'code',
        'redirect_uri': Config.spotify_redirect_uri,
        'scope': SCOPES,
        'show_dialog': 'false',
    }
    query = '&'.join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    return redirect(f"{SPOTIFY_AUTH_URL}?{query}")


@spotify_auth_bp.route('/auth/spotify/callback')
def spotify_callback():
    if not Config.spotify_credentials_available:
        return redirect(f"{Config.frontend_url}/spotify-success?error=spotify_not_configured")

    error = request.args.get('error')
    if error:
        logger.warning({'event': 'spotify_auth_error', 'error': error})
        return redirect(f"{Config.frontend_url}/spotify-success?error={error}")

    code = request.args.get('code')
    if not code:
        logger.warning({'event': 'spotify_callback_missing_code'})
        return redirect(f"{Config.frontend_url}/spotify-success?error=no_code")

    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            headers={
                'Authorization': _basic_auth_header(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': Config.spotify_redirect_uri,
            },
            timeout=10,
        )
        if not resp.ok:
            logger.warning({'event': 'spotify_token_exchange_failed', 'status': resp.status_code, 'body': resp.text})
            return redirect(f"{Config.frontend_url}/spotify-success?error=token_exchange_failed")
        token_data = resp.json()
    except requests.RequestException as exc:
        logger.error({'event': 'spotify_token_exchange_exception', 'error': str(exc)})
        return redirect(f"{Config.frontend_url}/spotify-success?error=token_exchange_failed")

    access_token = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in = token_data.get('expires_in', 3600)

    if not access_token:
        logger.warning({'event': 'spotify_token_missing_access_token'})
        return redirect(f"{Config.frontend_url}/spotify-success?error=no_access_token")

    exchange_code = _store_exchange_payload(
        {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': expires_in,
        }
    )
    return redirect(f"{Config.frontend_url}/spotify-success?auth_code={exchange_code}")


@spotify_auth_bp.route('/auth/spotify/exchange', methods=['POST'])
def spotify_exchange():
    payload = request.get_json(silent=True) or {}
    token_payload = _consume_exchange_payload(payload.get('code'))
    if not token_payload:
        return api_error('exchange code expired', 410, code='SPOTIFY_EXCHANGE_CODE_EXPIRED')

    app_session = create_spotify_app_session(token_payload['access_token'])
    if not app_session:
        return api_error('Spotify profile could not be loaded for app session creation', 502, code='SPOTIFY_PROFILE_REQUIRED')

    response, status = api_success(
        {
            'provider': 'spotify',
            'status': 'connected',
            'expires_in': token_payload.get('expires_in', 3600),
            'user_id': app_session['user_id'],
            'session': 'authenticated',
            'spotify_user_id': app_session.get('spotify_user_id'),
            'display_name': app_session.get('display_name'),
        }
    )
    set_spotify_cookies(
        response,
        access_token=token_payload['access_token'],
        refresh_token=token_payload.get('refresh_token'),
        expires_in=token_payload.get('expires_in', 3600),
    )
    set_auth_cookie(response, app_session['token'], ttl_seconds=60 * 60 * 24 * 30)
    return response, status


def refresh_spotify_token(refresh_token: str) -> dict | None:
    """Exchange a Spotify refresh token for a fresh access token.

    Returns a dict with ``access_token``, ``refresh_token`` (the new one if
    Spotify rotated it, else the one passed in), and ``expires_in`` — or
    ``None`` if the refresh failed. Used by both the explicit ``/refresh``
    route and the self-healing session bootstrap path so a connected user
    whose 1-hour access cookie has expired stays connected without re-login.
    """
    if not refresh_token or not Config.spotify_credentials_available:
        return None

    # Single-flight: reuse a recently-minted token for this refresh cookie so a
    # burst of bootstraps doesn't rotate the access token on every call.
    with _refresh_lock:
        entry = _refresh_cache.get(refresh_token)
        if entry and entry[0] > time.time():
            return entry[1]

    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            headers={
                'Authorization': _basic_auth_header(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data={
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        access_token = data.get('access_token')
        if not access_token:
            logger.warning({'event': 'spotify_refresh_missing_access_token'})
            return None
        result = {
            'access_token': access_token,
            'refresh_token': data.get('refresh_token') or refresh_token,
            'expires_in': data.get('expires_in', 3600),
        }
        with _refresh_lock:
            _refresh_cache[refresh_token] = (time.time() + _REFRESH_CACHE_TTL, result)
            if result['refresh_token'] != refresh_token:
                _refresh_cache[result['refresh_token']] = (time.time() + _REFRESH_CACHE_TTL, result)
        return result
    except requests.RequestException as exc:
        logger.error({'event': 'spotify_refresh_failed', 'error': str(exc)})
        return None


@spotify_auth_bp.route('/auth/spotify/refresh', methods=['POST'])
def spotify_refresh():
    if not Config.spotify_credentials_available:
        return api_error('Spotify OAuth is not configured', 503, code='SPOTIFY_OAUTH_UNAVAILABLE')

    payload = request.get_json(silent=True) or {}
    refresh_token = payload.get('refresh_token') or request.cookies.get('mm_spotify_refresh')
    if not refresh_token:
        return api_error('refresh_token required', 400, code='REFRESH_TOKEN_REQUIRED')

    refreshed = refresh_spotify_token(refresh_token)
    if not refreshed:
        return api_error('Spotify token refresh failed', 500, code='SPOTIFY_REFRESH_FAILED')

    response, status = api_success(
        {
            'provider': 'spotify',
            'status': 'connected',
            'expires_in': refreshed['expires_in'],
        }
    )
    set_spotify_cookies(
        response,
        access_token=refreshed['access_token'],
        refresh_token=refreshed['refresh_token'],
        expires_in=refreshed['expires_in'],
    )
    return response, status


@spotify_auth_bp.route('/auth/spotify/logout', methods=['POST'])
def spotify_logout():
    response, status = api_success({'provider': 'spotify', 'status': 'disconnected'})
    clear_spotify_cookies(response)
    return response, status

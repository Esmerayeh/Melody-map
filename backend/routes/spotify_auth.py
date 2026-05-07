"""Spotify OAuth routes with short-lived browser-safe exchange codes."""

from __future__ import annotations

import base64
import secrets
import time

import requests
from flask import Blueprint, redirect, request

from config import Config
from utils.api import api_error, api_success
from utils.logger import logger
from utils.provider_cookies import clear_spotify_cookies, set_spotify_cookies

spotify_auth_bp = Blueprint('spotify_auth', __name__)

SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
TOKEN_EXCHANGE_TTL = 120
_token_exchange_cache: dict[str, dict] = {}

SCOPES = ' '.join([
    'user-read-email',
    'user-read-private',
    'user-top-read',
    'playlist-read-private',
    'user-library-read',
])


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

    response, status = api_success(
        {
            'provider': 'spotify',
            'status': 'connected',
            'expires_in': token_payload.get('expires_in', 3600),
        }
    )
    set_spotify_cookies(
        response,
        access_token=token_payload['access_token'],
        refresh_token=token_payload.get('refresh_token'),
        expires_in=token_payload.get('expires_in', 3600),
    )
    return response, status


@spotify_auth_bp.route('/auth/spotify/refresh', methods=['POST'])
def spotify_refresh():
    if not Config.spotify_credentials_available:
        return api_error('Spotify OAuth is not configured', 503, code='SPOTIFY_OAUTH_UNAVAILABLE')

    payload = request.get_json(silent=True) or {}
    refresh_token = payload.get('refresh_token') or request.cookies.get('mm_spotify_refresh')
    if not refresh_token:
        return api_error('refresh_token required', 400, code='REFRESH_TOKEN_REQUIRED')

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
        response, status = api_success(
            {
                'provider': 'spotify',
                'status': 'connected',
                'expires_in': data.get('expires_in', 3600),
            }
        )
        set_spotify_cookies(
            response,
            access_token=data['access_token'],
            refresh_token=data.get('refresh_token') or refresh_token,
            expires_in=data.get('expires_in', 3600),
        )
        return response, status
    except requests.RequestException as exc:
        logger.error({'event': 'spotify_refresh_failed', 'error': str(exc)})
        return api_error('Spotify token refresh failed', 500, code='SPOTIFY_REFRESH_FAILED')


@spotify_auth_bp.route('/auth/spotify/logout', methods=['POST'])
def spotify_logout():
    response, status = api_success({'provider': 'spotify', 'status': 'disconnected'})
    clear_spotify_cookies(response)
    return response, status

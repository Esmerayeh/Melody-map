"""
Spotify OAuth routes.
Flow:
  1. Frontend hits /auth/spotify/login and is redirected to Spotify.
  2. Spotify redirects to /auth/spotify/callback with ?code=...
  3. Backend exchanges the provider code for Spotify tokens and stores them in
     a short-lived exchange cache.
  4. Frontend receives only ?auth_code=... and swaps it for secure HTTP-only
     provider cookies via /auth/spotify/exchange.

Redirect URI rules (Spotify post-April 2025):
  - "localhost" is no longer accepted as a redirect URI hostname.
  - Use loopback IP literals instead:
      Local dev (IPv4): http://127.0.0.1:5000/auth/spotify/callback
      Local dev (IPv6): http://[::1]:5000/auth/spotify/callback
      Production:       https://yourdomain.com/auth/spotify/callback
  - Register exactly the value of SPOTIFY_REDIRECT_URI in the Spotify dashboard.
  - HTTP is only permitted for loopback addresses; all other URIs must use HTTPS.
"""

import base64
import secrets
import time

import requests
from flask import Blueprint, make_response, redirect, request

from config import Config
from utils.api import api_error, api_success
from utils.logger import logger
from utils.provider_cookies import (
    SPOTIFY_ACCESS_COOKIE,
    SPOTIFY_REFRESH_COOKIE,
    clear_spotify_cookies,
    get_cookie,
    set_cookie,
)

spotify_auth_bp = Blueprint('spotify_auth', __name__)

SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
TOKEN_EXCHANGE_TTL = 120
_token_exchange_cache = {}

SCOPES = ' '.join(
    [
        'user-read-email',
        'user-read-private',
        'user-top-read',
        'playlist-read-private',
        'user-library-read',
    ]
)


def _basic_auth_header():
    """Return Base64-encoded Basic auth header for Spotify token endpoint."""
    creds = f"{Config.spotify_client_id}:{Config.spotify_client_secret}"
    encoded = base64.b64encode(creds.encode()).decode()
    return f"Basic {encoded}"


def _store_exchange_payload(payload):
    code = secrets.token_urlsafe(32)
    _token_exchange_cache[code] = {
        'payload': payload,
        'expires_at': time.time() + TOKEN_EXCHANGE_TTL,
    }
    return code


def _consume_exchange_payload(code):
    if not code:
        return None
    entry = _token_exchange_cache.pop(code, None)
    if not entry:
        return None
    if entry['expires_at'] < time.time():
        return None
    return entry['payload']


def _exchange_spotify_code(code):
    return requests.post(
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


def _refresh_spotify_token(refresh_token):
    return requests.post(
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


@spotify_auth_bp.route('/auth/spotify/login')
def spotify_login():
    """Redirect the user to Spotify's authorization page."""
    if not Config.spotify_credentials_available:
        return api_error('Spotify OAuth is not configured', 503, code='SPOTIFY_OAUTH_UNAVAILABLE')
    params = {
        'client_id': Config.spotify_client_id,
        'response_type': 'code',
        'redirect_uri': Config.spotify_redirect_uri,
        'scope': SCOPES,
        'show_dialog': 'false',
    }
    query = '&'.join(f"{key}={requests.utils.quote(str(value))}" for key, value in params.items())
    return redirect(f"{SPOTIFY_AUTH_URL}?{query}")


@spotify_auth_bp.route('/auth/spotify/callback')
def spotify_callback():
    """Handle Spotify's redirect and mint a short-lived auth_code for the frontend."""
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
        resp = _exchange_spotify_code(code)
        if not resp.ok:
            logger.warning(
                {
                    'event': 'spotify_token_exchange_failed',
                    'status': resp.status_code,
                    'body': resp.text,
                }
            )
            return redirect(
                f"{Config.frontend_url}/spotify-success"
                f"?error=token_exchange_failed&detail={requests.utils.quote(resp.text)}"
            )
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
            'token_type': token_data.get('token_type', 'Bearer'),
        }
    )

    return redirect(f"{Config.frontend_url}/spotify-success?auth_code={exchange_code}")


@spotify_auth_bp.route('/auth/spotify/refresh', methods=['POST'])
def spotify_refresh():
    """Refresh an expired Spotify access token using the secure refresh cookie."""
    if not Config.spotify_credentials_available:
        return api_error('Spotify OAuth is not configured', 503, code='SPOTIFY_OAUTH_UNAVAILABLE')
    refresh_token = get_cookie(request, SPOTIFY_REFRESH_COOKIE)
    if not refresh_token:
        return api_error('refresh token required', 400, code='REFRESH_TOKEN_REQUIRED')

    try:
        resp = _refresh_spotify_token(refresh_token)
        resp.raise_for_status()
        data = resp.json()
        response = make_response(
            api_success(
                {
                    'provider': 'spotify',
                    'connected': True,
                    'expires_in': data.get('expires_in', 3600),
                }
            )
        )
        set_cookie(response, SPOTIFY_ACCESS_COOKIE, data['access_token'])
        if data.get('refresh_token'):
            set_cookie(response, SPOTIFY_REFRESH_COOKIE, data['refresh_token'])
        return response
    except requests.RequestException as exc:
        logger.error({'event': 'spotify_refresh_failed', 'error': str(exc)})
        return api_error('Spotify token refresh failed', 500, code='SPOTIFY_REFRESH_FAILED')


@spotify_auth_bp.route('/auth/spotify/exchange', methods=['POST'])
def spotify_exchange():
    """Exchange a short-lived auth_code for HTTP-only Spotify provider cookies."""
    payload = request.get_json(silent=True) or {}
    code = payload.get('code')
    if not code:
        return api_error('exchange code required', 400, code='SPOTIFY_EXCHANGE_CODE_REQUIRED')

    token_payload = _consume_exchange_payload(code)
    if not token_payload:
        return api_error('exchange code expired', 410, code='SPOTIFY_EXCHANGE_CODE_EXPIRED')

    response = make_response(
        api_success(
            {
                'provider': 'spotify',
                'connected': True,
                'expires_in': token_payload.get('expires_in', 3600),
            }
        )
    )
    set_cookie(response, SPOTIFY_ACCESS_COOKIE, token_payload['access_token'])
    if token_payload.get('refresh_token'):
        set_cookie(response, SPOTIFY_REFRESH_COOKIE, token_payload['refresh_token'])
    return response


@spotify_auth_bp.route('/auth/spotify/logout', methods=['POST'])
def spotify_logout():
    response = make_response(api_success({'provider': 'spotify', 'connected': False}))
    clear_spotify_cookies(response)
    return response

"""
Last.fm Web Auth routes.
Flow:
  1. Frontend hits /auth/lastfm/login and is redirected to Last.fm.
  2. Last.fm redirects to /auth/lastfm/callback with a provider-issued token.
  3. Backend exchanges the provider token for a Last.fm session key.
  4. Backend redirects the browser back with only ?auth_code=...
  5. Frontend swaps auth_code for HTTP-only provider cookies via
     /auth/lastfm/exchange.

We never place provider session credentials in browser-visible URLs.
"""

import hashlib
import secrets
import time

import requests
from flask import Blueprint, make_response, redirect, request

from config import Config
from utils.api import api_error, api_success
from utils.logger import logger
from utils.provider_cookies import (
    LASTFM_SESSION_COOKIE,
    LASTFM_USERNAME_COOKIE,
    clear_lastfm_cookies,
    set_cookie,
)

lastfm_auth_bp = Blueprint('lastfm_auth', __name__)

LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/'
LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/'
TOKEN_EXCHANGE_TTL = 120
_token_exchange_cache = {}


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
    if not entry or entry['expires_at'] < time.time():
        return None
    return entry['payload']


def _api_sig(params: dict) -> str:
    secret = Config.lastfm_api_secret or ''
    sig_str = ''.join(f"{k}{v}" for k, v in sorted(params.items()) if k != 'format')
    sig_str += secret
    return hashlib.md5(sig_str.encode('utf-8')).hexdigest()


@lastfm_auth_bp.route('/auth/lastfm/login')
def lastfm_login():
    """Redirect user to Last.fm authorization page."""
    url = (
        f"{LASTFM_AUTH_URL}"
        f"?api_key={Config.lastfm_api_key}"
        f"&cb={requests.utils.quote(Config.lastfm_redirect_uri)}"
    )
    return redirect(url)


@lastfm_auth_bp.route('/auth/lastfm/callback')
def lastfm_callback():
    """Receive a Last.fm token, exchange it for a session key, then hand out a short-lived exchange code."""
    token = request.args.get('token')
    if not token:
        return redirect(f"{Config.frontend_url}/lastfm-success?error=no_token")

    params = {
        'method': 'auth.getSession',
        'api_key': Config.lastfm_api_key,
        'token': token,
    }
    params['api_sig'] = _api_sig(params)
    params['format'] = 'json'

    try:
        resp = requests.get(LASTFM_API_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.error({'event': 'lastfm_session_exchange_failed', 'error': str(exc)})
        return redirect(f"{Config.frontend_url}/lastfm-success?error=session_failed")

    if 'error' in data:
        message = data.get('message', 'auth_failed')
        return redirect(f"{Config.frontend_url}/lastfm-success?error={requests.utils.quote(message)}")

    session = data['session']
    exchange_code = _store_exchange_payload({
        'session': session['key'],
        'username': session['name'],
    })
    return redirect(f"{Config.frontend_url}/lastfm-success?auth_code={exchange_code}")


@lastfm_auth_bp.route('/auth/lastfm/exchange', methods=['POST'])
def lastfm_exchange():
    """Swap a short-lived exchange code for HTTP-only Last.fm cookies."""
    payload = request.get_json(silent=True) or {}
    code = payload.get('code')
    if not code:
        return api_error('exchange code required', 400, code='LASTFM_EXCHANGE_CODE_REQUIRED')

    session_payload = _consume_exchange_payload(code)
    if not session_payload:
        return api_error('exchange code expired', 410, code='LASTFM_EXCHANGE_CODE_EXPIRED')

    response = make_response(
        api_success(
            {
                'provider': 'lastfm',
                'connected': True,
                'username': session_payload['username'],
            }
        )
    )
    set_cookie(response, LASTFM_SESSION_COOKIE, session_payload['session'])
    set_cookie(response, LASTFM_USERNAME_COOKIE, session_payload['username'])
    return response


@lastfm_auth_bp.route('/auth/lastfm/logout', methods=['POST'])
def lastfm_logout():
    response = make_response(api_success({'provider': 'lastfm', 'connected': False}))
    clear_lastfm_cookies(response)
    return response

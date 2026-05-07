"""Last.fm OAuth routes with short-lived browser-safe exchange codes."""

from __future__ import annotations

import hashlib
import secrets
import time

import requests
from flask import Blueprint, redirect, request

from config import Config
from utils.api import api_success
from utils.logger import logger
from utils.provider_cookies import clear_lastfm_cookies, set_lastfm_cookies

lastfm_auth_bp = Blueprint('lastfm_auth', __name__)

LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/'
LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/'
TOKEN_EXCHANGE_TTL = 120
_token_exchange_cache: dict[str, dict] = {}


def _api_sig(params: dict) -> str:
    secret = Config.lastfm_api_secret or ''
    sig_str = ''.join(f"{k}{v}" for k, v in sorted(params.items()) if k != 'format')
    sig_str += secret
    return hashlib.md5(sig_str.encode('utf-8')).hexdigest()


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


@lastfm_auth_bp.route('/auth/lastfm/login')
def lastfm_login():
    url = (
        f"{LASTFM_AUTH_URL}"
        f"?api_key={Config.lastfm_api_key}"
        f"&cb={requests.utils.quote(Config.lastfm_redirect_uri)}"
    )
    return redirect(url)


@lastfm_auth_bp.route('/auth/lastfm/callback')
def lastfm_callback():
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
        msg = data.get('message', 'auth_failed')
        return redirect(f"{Config.frontend_url}/lastfm-success?error={requests.utils.quote(msg)}")

    session = data['session']
    exchange_code = _store_exchange_payload(
        {
            'session_key': session['key'],
            'username': session['name'],
        }
    )
    return redirect(f"{Config.frontend_url}/lastfm-success?auth_code={exchange_code}")


@lastfm_auth_bp.route('/auth/lastfm/exchange', methods=['POST'])
def lastfm_exchange():
    payload = request.get_json(silent=True) or {}
    session_payload = _consume_exchange_payload(payload.get('code'))
    if not session_payload:
        from utils.api import api_error
        return api_error('exchange code expired', 410, code='LASTFM_EXCHANGE_CODE_EXPIRED')

    response, status = api_success(
        {
            'provider': 'lastfm',
            'status': 'connected',
            'username': session_payload['username'],
        }
    )
    set_lastfm_cookies(
        response,
        session_key=session_payload['session_key'],
        username=session_payload['username'],
    )
    return response, status


@lastfm_auth_bp.route('/auth/lastfm/logout', methods=['POST'])
def lastfm_logout():
    response, status = api_success({'provider': 'lastfm', 'status': 'disconnected'})
    clear_lastfm_cookies(response)
    return response, status

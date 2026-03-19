"""
Last.fm Web Auth routes.
Flow:
  1. Frontend hits /auth/lastfm/login  -> redirects to Last.fm
  2. Last.fm redirects to /auth/lastfm/callback?token=...
  3. We exchange token for a session key via auth.getSession
  4. Redirect user back to {FRONTEND_URL}/lastfm-success?session=...&username=...
"""

import hashlib
import requests
from flask import Blueprint, redirect, request
from config import Config

lastfm_auth_bp = Blueprint('lastfm_auth', __name__)

LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/'
LASTFM_API_URL  = 'https://ws.audioscrobbler.com/2.0/'


def _api_sig(params: dict) -> str:
    secret  = Config.LASTFM_API_SECRET or ''
    sig_str = ''.join(f"{k}{v}" for k, v in sorted(params.items()) if k != 'format')
    sig_str += secret
    return hashlib.md5(sig_str.encode('utf-8')).hexdigest()


@lastfm_auth_bp.route('/auth/lastfm/login')
def lastfm_login():
    """Redirect user to Last.fm authorization page."""
    url = (
        f"{LASTFM_AUTH_URL}"
        f"?api_key={Config.LASTFM_API_KEY}"
        f"&cb={requests.utils.quote(Config.LASTFM_REDIRECT_URI)}"
    )
    return redirect(url)


@lastfm_auth_bp.route('/auth/lastfm/callback')
def lastfm_callback():
    """Receive Last.fm token, exchange for session key, redirect to frontend."""
    token = request.args.get('token')
    if not token:
        return redirect(f"{Config.FRONTEND_URL}/lastfm-success?error=no_token")

    params = {
        'method':  'auth.getSession',
        'api_key': Config.LASTFM_API_KEY,
        'token':   token,
    }
    params['api_sig'] = _api_sig(params)
    params['format']  = 'json'

    try:
        resp = requests.get(LASTFM_API_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[Last.fm] Session exchange error: {e}")
        return redirect(f"{Config.FRONTEND_URL}/lastfm-success?error=session_failed")

    if 'error' in data:
        msg = data.get('message', 'auth_failed')
        return redirect(f"{Config.FRONTEND_URL}/lastfm-success?error={requests.utils.quote(msg)}")

    session  = data['session']
    sess_key = session['key']
    username = session['name']

    # Always redirect back to the FRONTEND — never leave the user on the backend domain
    return redirect(
        f"{Config.FRONTEND_URL}/lastfm-success"
        f"?session={sess_key}"
        f"&username={requests.utils.quote(username)}"
    )

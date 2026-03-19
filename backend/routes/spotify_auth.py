"""
Spotify OAuth routes.
Flow:
  1. Frontend hits /auth/spotify/login  → redirects to Spotify
  2. Spotify redirects to /auth/spotify/callback with ?code=...
  3. We exchange code for tokens, then redirect frontend to
     {FRONTEND_URL}/spotify-success?token=ACCESS_TOKEN

Redirect URI rules (Spotify post-April 2025):
  - "localhost" is no longer accepted as a redirect URI hostname.
  - Use loopback IP literals instead:
      Local dev (IPv4): http://127.0.0.1:5000/auth/spotify/callback
      Local dev (IPv6): http://[::1]:5000/auth/spotify/callback
      Production:       https://yourdomain.com/auth/spotify/callback
  - Register EXACTLY the value of SPOTIFY_REDIRECT_URI in your Spotify
    Developer Dashboard → App → Edit Settings → Redirect URIs.
  - HTTP is only permitted for loopback addresses; all other URIs must use HTTPS.
"""

import requests
import base64
from flask import Blueprint, redirect, request, jsonify, current_app
from config import Config

spotify_auth_bp = Blueprint('spotify_auth', __name__)

SPOTIFY_AUTH_URL  = 'https://accounts.spotify.com/authorize'
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

SCOPES = ' '.join([
    'user-read-email',
    'user-read-private',
    'user-top-read',
    'playlist-read-private',
    'user-library-read',
])


def _basic_auth_header():
    """Return Base64-encoded Basic auth header for Spotify token endpoint."""
    creds = f"{Config.SPOTIFY_CLIENT_ID}:{Config.SPOTIFY_CLIENT_SECRET}"
    encoded = base64.b64encode(creds.encode()).decode()
    return f"Basic {encoded}"


@spotify_auth_bp.route('/auth/spotify/login')
def spotify_login():
    """Redirect the user to Spotify's authorization page."""
    params = {
        'client_id':     Config.SPOTIFY_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri':  Config.SPOTIFY_REDIRECT_URI,
        'scope':         SCOPES,
        'show_dialog':   'false',
    }
    query = '&'.join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    return redirect(f"{SPOTIFY_AUTH_URL}?{query}")


@spotify_auth_bp.route('/auth/spotify/callback')
def spotify_callback():
    """Handle Spotify's redirect, exchange code for tokens."""
    print(f"[Spotify] Callback hit. args={dict(request.args)}")
    error = request.args.get('error')
    if error:
        print(f"[Spotify] Auth error from Spotify: {error}")
        return redirect(f"{Config.FRONTEND_URL}/spotify-success?error={error}")

    code = request.args.get('code')
    if not code:
        print("[Spotify] No code in callback")
        return redirect(f"{Config.FRONTEND_URL}/spotify-success?error=no_code")

    # Exchange authorization code for access token
    print(f"[Spotify] Exchanging code for token. redirect_uri={Config.SPOTIFY_REDIRECT_URI!r}")
    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            headers={
                'Authorization': _basic_auth_header(),
                'Content-Type':  'application/x-www-form-urlencoded',
            },
            data={
                'grant_type':   'authorization_code',
                'code':          code,
                'redirect_uri':  Config.SPOTIFY_REDIRECT_URI,
            },
            timeout=10,
        )
        print(f"[Spotify] Token response status: {resp.status_code}")
        if not resp.ok:
            print(f"[Spotify] Token error body: {resp.text}")
            return redirect(f"{Config.FRONTEND_URL}/spotify-success?error=token_exchange_failed&detail={requests.utils.quote(resp.text)}")
        token_data = resp.json()
    except requests.RequestException as e:
        print(f"[Spotify] Token exchange exception: {e}")
        return redirect(f"{Config.FRONTEND_URL}/spotify-success?error=token_exchange_failed")

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 3600)

    if not access_token:
        print(f"[Spotify] No access_token in response: {token_data}")
        return redirect(f"{Config.FRONTEND_URL}/spotify-success?error=no_access_token")

    # Redirect frontend with token in query string
    return redirect(
        f"{Config.FRONTEND_URL}/spotify-success"
        f"?token={access_token}"
        f"&refresh_token={refresh_token}"
        f"&expires_in={expires_in}"
    )


@spotify_auth_bp.route('/auth/spotify/refresh', methods=['POST'])
def spotify_refresh():
    """Refresh an expired Spotify access token."""
    refresh_token = request.json.get('refresh_token')
    if not refresh_token:
        return jsonify({'error': 'refresh_token required'}), 400

    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            headers={
                'Authorization': _basic_auth_header(),
                'Content-Type':  'application/x-www-form-urlencoded',
            },
            data={
                'grant_type':    'refresh_token',
                'refresh_token':  refresh_token,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return jsonify({
            'access_token': data['access_token'],
            'expires_in':   data.get('expires_in', 3600),
        })
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

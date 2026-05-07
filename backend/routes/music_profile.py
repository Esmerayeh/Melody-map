"""
Music Profile route
-------------------
GET  /api/music-profile   — build and return a complete music profile
                            from the user's Spotify data.

Query params:
  time_range  short_term | medium_term (default) | long_term
  limit       1–50 (default 50)

Headers:
  X-Spotify-Token   <spotify_access_token>

Response: see music_profile_builder.build_music_profile()
"""

import jwt
from flask import Blueprint, current_app, request

from middleware.rate_limit import rate_limit
from services.profile_runtime import resolve_profile_response
from services.feature_store import register_profile_snapshot
from utils.api import api_error, api_success_legacy
from utils.auth_cookies import auth_token_from_request
from utils.logger import logger
from utils.provider_cookies import spotify_context_from_request

music_profile_bp = Blueprint('music_profile', __name__)


@music_profile_bp.route('/api/music-profile', methods=['GET'])
@rate_limit(max_requests=30, window_seconds=60)
def get_music_profile():
    cookie_token, _, _ = spotify_context_from_request(request)
    token = (
        request.headers.get('X-Spotify-Token') or
        request.headers.get('Authorization', '').replace('Bearer ', '').strip() or
        cookie_token
    )
    if not token:
        return api_error('Spotify token required (X-Spotify-Token header)', 401, code='SPOTIFY_TOKEN_REQUIRED')

    time_range = request.args.get('time_range', 'medium_term')
    if time_range not in ('short_term', 'medium_term', 'long_term'):
        time_range = 'medium_term'

    try:
        limit = min(int(request.args.get('limit', 50)), 50)
    except (ValueError, TypeError):
        limit = 50

    try:
        resolved, status = resolve_profile_response(
            spotify_token=token,
            time_range=time_range,
            limit=limit,
        )
        profile = resolved["profile"]
        data_quality = profile.get('dataQuality') or profile.get('data_quality')
        confidence = profile.get('confidence')
        profile_tier = profile.get('profileTier') or profile.get('profile_tier')
        warnings = list(dict.fromkeys([*(profile.get('warnings') or []), *(resolved.get('warnings') or [])]))
        user_id = None
        token_for_auth = auth_token_from_request(request)
        if token_for_auth:
            try:
                payload = jwt.decode(token_for_auth, current_app.config["SECRET_KEY"], algorithms=["HS256"])
                user_id = payload.get("user_id")
            except jwt.InvalidTokenError:
                user_id = None
        snapshot = None
        if status == 200 and profile.get("topArtists"):
            snapshot = register_profile_snapshot(
                profile,
                user_id=user_id,
                provider_user_id=(profile.get("userProfile") or {}).get("id"),
            )
        return api_success_legacy(
            profile,
            status=status,
            confidence=confidence,
            dataQuality=data_quality,
            profileTier=profile_tier,
            warnings=warnings,
            cache=resolved.get('cache'),
            job=resolved.get('job'),
            breaker=resolved.get('breaker'),
            snapshot=snapshot,
        )
    except Exception as e:
        logger.error({'event': 'music_profile_build_failed', 'error': str(e), 'time_range': time_range, 'limit': limit})
        return api_error('Music profile generation failed', 500, code='MUSIC_PROFILE_BUILD_FAILED')

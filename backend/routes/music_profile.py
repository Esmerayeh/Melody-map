"""
Music Profile route.

GET /api/music-profile builds and returns a complete music profile
from the user's Spotify data.

Query params:
  time_range  short_term | medium_term (default) | long_term
  limit       1-50 (default 50)

Auth:
  Prefers the secure Spotify provider cookie set during OAuth exchange.
  Falls back to Authorization for local compatibility.
"""

from flask import Blueprint, request

from middleware.rate_limit import rate_limit
from services.music_profile_builder import build_music_profile
from utils.api import api_error, api_success_legacy
from utils.logger import logger
from utils.provider_cookies import SPOTIFY_ACCESS_COOKIE, get_cookie

music_profile_bp = Blueprint('music_profile', __name__)


@music_profile_bp.route('/api/music-profile', methods=['GET'])
@rate_limit(max_requests=30, window_seconds=60)
def get_music_profile():
    token = (
        get_cookie(request, SPOTIFY_ACCESS_COOKIE)
        or request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    )
    if not token:
        return api_error('Spotify connection required', 401, code='SPOTIFY_TOKEN_REQUIRED')

    time_range = request.args.get('time_range', 'medium_term')
    if time_range not in ('short_term', 'medium_term', 'long_term'):
        time_range = 'medium_term'

    try:
        limit = min(int(request.args.get('limit', 50)), 50)
    except (ValueError, TypeError):
        limit = 50

    try:
        profile = build_music_profile(
            spotify_token=token,
            time_range=time_range,
            limit=limit,
        )
        data_quality = profile.get('dataQuality') or profile.get('data_quality')
        confidence = profile.get('confidence')
        profile_tier = profile.get('profileTier') or profile.get('profile_tier')
        warnings = profile.get('warnings') or []
        return api_success_legacy(
            profile,
            status=200,
            confidence=confidence,
            dataQuality=data_quality,
            profileTier=profile_tier,
            warnings=warnings,
        )
    except Exception as exc:
        logger.error(
            {
                'event': 'music_profile_build_failed',
                'error': str(exc),
                'time_range': time_range,
                'limit': limit,
            }
        )
        return api_error('Music profile generation failed', 500, code='MUSIC_PROFILE_BUILD_FAILED')

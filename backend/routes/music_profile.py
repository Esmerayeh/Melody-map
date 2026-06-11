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
from services.listening_memory import build_listening_memory_model
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

    # Resolve the app user id up front so the profile cache is keyed on a stable
    # identity (not the rotating Spotify access token). Without this, every poll
    # carries a freshly-refreshed token → cache miss → the finished build is never
    # served and the profile is stuck on the 202 placeholder forever.
    user_id = None
    token_for_auth = auth_token_from_request(request)
    if token_for_auth:
        try:
            payload = jwt.decode(token_for_auth, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            user_id = payload.get("user_id")
        except jwt.InvalidTokenError:
            user_id = None

    try:
        resolved, status = resolve_profile_response(
            spotify_token=token,
            time_range=time_range,
            limit=limit,
            cache_seed=user_id,
        )
        profile = resolved["profile"]
        data_quality = profile.get('dataQuality') or profile.get('data_quality')
        confidence = profile.get('confidence')
        profile_tier = profile.get('profileTier') or profile.get('profile_tier')
        warnings = list(dict.fromkeys([*(profile.get('warnings') or []), *(resolved.get('warnings') or [])]))
        snapshot = None
        if status == 200 and profile.get("topArtists"):
            # ── Field-population diagnostic (classification: bug vs deprecation) ──
            # Traces exactly which profile fields are populated vs empty for THIS
            # served profile, so partial-state can be classified to its source.
            try:
                _af = profile.get("audioFeatures") or {}
                _am = profile.get("analyticsMetrics") or {}
                logger.info({
                    "event": "music_profile_field_map",
                    "fromSpotifyTopEndpoints": {
                        "topArtists": len(profile.get("topArtists") or []),
                        "topTracks": len(profile.get("topTracks") or []),
                        "genres": len(profile.get("genres") or []),
                        "recentlyPlayed": len(profile.get("recentlyPlayed") or []),
                        "savedTracks": len(profile.get("savedTracks") or []),
                        "galaxyNodes": len(profile.get("galaxyNodes") or []),
                        "aestheticTags": len(profile.get("aestheticTags") or []),
                    },
                    "audioFeaturesPopulated": {k: (v is not None) for k, v in _af.items()},
                    "analyticsPopulated": {k: (v is not None) for k, v in _am.items() if k not in ("sampleSizes", "metricConfidence", "featureCoverageByMetric", "methodology")},
                    "identity": {
                        "personalityTraits": len(profile.get("personality") or []),
                        "mbtiValue": (profile.get("mbti") or {}).get("type") if isinstance(profile.get("mbti"), dict) else profile.get("mbti"),
                    },
                    "audioCoverage": (profile.get("dataQuality") or {}).get("audioCoverage"),
                    "audioFeatureSource": ((profile.get("dataQuality") or {}).get("audioFeatureDiagnostics") or {}).get("source"),
                    "readiness": {
                        "analytics": (profile.get("analyticsReadiness") or {}).get("ready"),
                        "identity": (profile.get("identityReadiness") or {}).get("ready"),
                        "mbti": (profile.get("identityReadiness") or {}).get("mbtiReady"),
                        "soulmate": (profile.get("soulmateReadiness") or {}).get("ready"),
                    },
                })
            except Exception as _diag_exc:
                logger.warning({"event": "music_profile_field_map_failed", "error": str(_diag_exc)})
            effective_listen_user = user_id or (profile.get("userProfile") or {}).get("id")
            # Post-build enrichment (listening memory, snapshot, sync, auralith) is
            # all best-effort. The profile itself is fully built and cached — a
            # failure in any enrichment step must NEVER turn a real 50-artist
            # profile into a 500. Guard each step independently and still return.
            try:
                profile["listeningMemory"] = build_listening_memory_model(
                    effective_listen_user,
                    profile,
                )
            except Exception as mem_exc:
                logger.error({"event": "listening_memory_failed", "error": str(mem_exc)}, exc_info=True)
            try:
                snapshot = register_profile_snapshot(
                    profile,
                    user_id=user_id,
                    provider_user_id=(profile.get("userProfile") or {}).get("id"),
                )
            except Exception as snap_exc:
                logger.error({"event": "profile_snapshot_failed", "error": str(snap_exc)}, exc_info=True)
            # ── Feed the realtime listening-events store ───────────────────────
            # Nothing else ingests Spotify recently-played for a logged-in user,
            # so Auralith memory, identity-drift and the live taste signal would
            # otherwise stay empty ("0 recent listening events"). Pull recent
            # plays into listening_events on every real profile sync. Best-effort:
            # a failure here must never break the profile response.
            if effective_listen_user:
                try:
                    from services.realtime_listening_sync import sync_spotify_listening
                    sync_result = sync_spotify_listening(effective_listen_user, token)
                    logger.info({
                        "event": "listening_sync_on_profile",
                        "user_id": effective_listen_user,
                        "inserted": sync_result.get("inserted"),
                        "deduped": sync_result.get("deduped"),
                    })
                except Exception as sync_exc:
                    logger.warning({"event": "listening_sync_on_profile_failed", "error": str(sync_exc)})
            # ── Build Auralith memory on profile sync ──────────────────────
            # Runs after every successful profile load so the oracle has
            # up-to-date memory without waiting for a listening event.
            effective_user_id = user_id or (profile.get("userProfile") or {}).get("id")
            if effective_user_id:
                try:
                    from services.auralith_memory import build_memory_chunks
                    build_memory_chunks(effective_user_id, profile=profile)
                    logger.info({"event": "auralith_memory_synced_on_profile", "user_id": effective_user_id})
                except Exception as mem_exc:
                    logger.warning({"event": "auralith_memory_profile_sync_failed", "error": str(mem_exc)})
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
        logger.error({'event': 'music_profile_build_failed', 'error': str(e), 'time_range': time_range, 'limit': limit}, exc_info=True)
        return api_error('Music profile generation failed', 500, code='MUSIC_PROFILE_BUILD_FAILED')

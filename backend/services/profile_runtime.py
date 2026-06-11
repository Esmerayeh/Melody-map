from __future__ import annotations

import hashlib
import time
from datetime import UTC, datetime

from services.music_profile_builder import PROFILE_SCHEMA_VERSION, build_music_profile
from utils.cache import cache_store
from utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from utils.jobs import job_registry
from utils.logger import logger


PROFILE_CACHE_TTL_SECONDS = 60 * 20
PROFILE_STALE_WINDOW_SECONDS = 60 * 60 * 6
PROFILE_BREAKER_KEY = "spotify_profile_generation"

profile_breaker = CircuitBreaker(failure_threshold=3, recovery_seconds=60)


def profile_cache_key(token: str, time_range: str, limit: int) -> str:
    digest = hashlib.sha256((token or "").encode("utf-8")).hexdigest()[:16]
    return f"music-profile:{digest}:{time_range}:{limit}"


def build_profile_placeholder(provider: str, time_range: str, reason: str, *, cache_state: str = "booting") -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "profileSchemaVersion": PROFILE_SCHEMA_VERSION,
        "provider": provider,
        "generatedAt": now,
        "syncedAt": now,
        "userProfile": None,
        "topArtists": [],
        "topTracks": [],
        "recentlyPlayed": [],
        "savedTracks": [],
        "audioFeatures": {},
        "audioFeaturesList": [],
        "galaxyNodes": [],
        "aestheticTags": [],
        "analyticsMetrics": None,
        "genres": [],
        "timeRange": time_range,
        "warnings": [reason],
        "dataQuality": {
            "provider": provider,
            "topArtistsCount": 0,
            "topTracksCount": 0,
            "genresCount": 0,
            "audioFeaturesRequested": 0,
            "audioFeaturesCount": 0,
            "audioCoverage": 0,
            "hasAudioProfile": False,
            "degradedReasons": [reason, cache_state],
            "sampleSizes": {},
            "featureCoverageByMetric": {},
        },
        "confidence": {
            "overall": 0,
            "analytics": {"score": 0, "label": "unavailable"},
            "identity": {"score": 0, "label": "unavailable"},
            "galaxy": {"score": 0, "label": "unavailable"},
            "soulmate": {"score": 0, "label": "unavailable"},
        },
        "analyticsReadiness": {
            "ready": False,
            "confidence": {"score": 0, "label": "unavailable"},
            "reasons": [reason],
        },
        "identityReadiness": {
            "ready": False,
            "confidence": {"score": 0, "label": "unavailable"},
            "mbtiReady": False,
            "reasons": [reason],
        },
        "soulmateReadiness": {
            "ready": False,
            "confidence": {"score": 0, "label": "unavailable"},
            "mode": "degraded",
            "reasons": [reason],
        },
        "profileTier": "limited",
    }


def _load_snapshot(cache_key: str) -> dict | None:
    cached = cache_store.get_json(cache_key)
    if not cached:
        return None
    cached_at = float(cached.get("cached_at") or 0)
    age = max(0.0, time.time() - cached_at)
    cached["age_seconds"] = age
    cached["fresh"] = age <= PROFILE_CACHE_TTL_SECONDS
    cached["stale_but_servable"] = age <= PROFILE_STALE_WINDOW_SECONDS
    return cached


def _store_snapshot(cache_key: str, profile: dict) -> dict:
    snapshot = {
        "profile": profile,
        "cached_at": time.time(),
        "schema_version": profile.get("profileSchemaVersion") or PROFILE_SCHEMA_VERSION,
    }
    cache_store.set_json(cache_key, snapshot, ttl_seconds=PROFILE_STALE_WINDOW_SECONDS)
    return snapshot


def _build_and_cache(cache_key: str, spotify_token: str, time_range: str, limit: int) -> dict:
    start = time.time()
    logger.info({"event": "build_begin", "cache_key": cache_key, "time_range": time_range, "limit": limit})
    profile_breaker.guard(PROFILE_BREAKER_KEY)
    profile = build_music_profile(spotify_token=spotify_token, time_range=time_range, limit=limit)
    profile_breaker.record_success(PROFILE_BREAKER_KEY)
    artist_count = len(profile.get("topArtists") or [])
    logger.info({"event": "build_pre_cache_write", "cache_key": cache_key, "topArtists": artist_count, "elapsedMs": round((time.time() - start) * 1000)})
    snapshot = _store_snapshot(cache_key, profile)
    logger.info({"event": "music_profile_cached", "cache_key": cache_key, "time_range": time_range, "limit": limit})
    logger.info({"event": "BUILD-COMPLETE", "cache_key": cache_key, "cached": True, "topArtists": artist_count, "elapsedSec": round(time.time() - start, 1)})
    return snapshot


def enqueue_profile_refresh(cache_key: str, spotify_token: str, time_range: str, limit: int) -> dict:
    return job_registry.submit(
        "music-profile-refresh",
        _build_and_cache,
        cache_key,
        spotify_token,
        time_range,
        limit,
        dedupe_key=f"profile:{cache_key}",
    )


def resolve_profile_response(spotify_token: str, time_range: str, limit: int, cache_seed: str | None = None) -> tuple[dict, int]:
    # Key the cache on a STABLE identity (the app/Spotify user id) when available,
    # NOT the access token. Tokens rotate (every refresh mints a new one), so a
    # token-keyed cache misses on every subsequent request — the completed build
    # is cached under one token's key and never read back, so the profile never
    # converges past the 202 placeholder. A stable seed lets the next poll hit the
    # finished build and return real data.
    cache_key = profile_cache_key(cache_seed or spotify_token, time_range, limit)
    cached = _load_snapshot(cache_key)
    logger.info({
        "event": "profile_read",
        "cache_key": cache_key,
        "cache_seed_present": bool(cache_seed),
        "cache_state": "hit_fresh" if (cached and cached.get("fresh")) else "hit_stale" if (cached and cached.get("stale_but_servable")) else "miss",
    })

    if cached and cached.get("fresh"):
        return {
            "profile": cached["profile"],
            "warnings": [],
            "cache": {"state": "fresh", "ageSeconds": round(cached["age_seconds"], 1)},
            "job": None,
            "breaker": profile_breaker.snapshot(PROFILE_BREAKER_KEY),
        }, 200

    if cached and cached.get("stale_but_servable"):
        job = enqueue_profile_refresh(cache_key, spotify_token, time_range, limit)
        warnings = ["profile_served_from_stale_cache", "refresh_enqueued"]
        profile = dict(cached["profile"])
        profile.setdefault("warnings", [])
        profile["warnings"] = list(dict.fromkeys([*profile.get("warnings", []), *warnings]))
        return {
            "profile": profile,
            "warnings": warnings,
            "cache": {"state": "stale", "ageSeconds": round(cached["age_seconds"], 1)},
            "job": {"id": job["id"], "status": job["status"]},
            "breaker": profile_breaker.snapshot(PROFILE_BREAKER_KEY),
        }, 200

    try:
        job = enqueue_profile_refresh(cache_key, spotify_token, time_range, limit)
        placeholder = build_profile_placeholder("spotify", time_range, "profile_bootstrap_pending", cache_state="queued")
        return {
            "profile": placeholder,
            "warnings": ["profile_bootstrap_pending"],
            "cache": {"state": "miss", "ageSeconds": None},
            "job": {"id": job["id"], "status": job["status"]},
            "breaker": profile_breaker.snapshot(PROFILE_BREAKER_KEY),
        }, 202
    except CircuitBreakerOpen:
        if cached and cached.get("profile"):
            profile = dict(cached["profile"])
            warnings = ["spotify_profile_circuit_open", "profile_served_from_cache"]
            profile["warnings"] = list(dict.fromkeys([*profile.get("warnings", []), *warnings]))
            return {
                "profile": profile,
                "warnings": warnings,
                "cache": {"state": "degraded_cache", "ageSeconds": round(cached["age_seconds"], 1)},
                "job": None,
                "breaker": profile_breaker.snapshot(PROFILE_BREAKER_KEY),
            }, 200
        placeholder = build_profile_placeholder("spotify", time_range, "spotify_profile_circuit_open", cache_state="circuit_open")
        return {
            "profile": placeholder,
            "warnings": ["spotify_profile_circuit_open"],
            "cache": {"state": "circuit_open", "ageSeconds": None},
            "job": None,
            "breaker": profile_breaker.snapshot(PROFILE_BREAKER_KEY),
        }, 202
    except Exception as exc:
        profile_breaker.record_failure(PROFILE_BREAKER_KEY)
        logger.error({"event": "music_profile_enqueue_failed", "error": str(exc)})
        raise

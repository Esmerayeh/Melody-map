"""
artist_feature_cache.py
-----------------------
Safe enrichment layer for Last.fm (and other non-Spotify) profiles.

When a user's profile lacks per-artist audio features (Last.fm, unauthenticated
Spotify, etc.), this service:

  1. Checks a MongoDB cache (artist_features collection) for known features.
  2. If a Spotify access token is available, requests audio features for
     uncached artists via the Spotify search + audio-features API.
  3. Caches results with a TTL so we don't hammer Spotify.
  4. NEVER blocks profile loading — all enrichment is best-effort.

Semantic coverage is reported back so the frontend can show:
  "42% of coordinates are estimated. Connect Spotify for a fuller signal."

Safety rules:
  - All failures are caught and logged as warnings.
  - enriched_audio_features returns empty dict on any error.
  - Profile loading must never fail because of this service.
"""
from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from utils.logger import logger

# Cache TTL: artist features don't change, so we cache aggressively.
CACHE_TTL_DAYS = 30
_mongo = None


def init_mongo(mongo_instance) -> None:
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.artist_features.create_index("artist_slug", unique=True)
        _mongo.db.artist_features.create_index("expires_at")
    except Exception:
        pass


def _artist_slug(name: str) -> str:
    return hashlib.sha256(name.lower().strip().encode()).hexdigest()[:24]


def get_cached_features(artist_name: str) -> dict | None:
    """Return cached audio features for an artist, or None if absent/expired."""
    if _mongo is None:
        return None
    try:
        slug = _artist_slug(artist_name)
        doc  = _mongo.db.artist_features.find_one({"artist_slug": slug})
        if doc and doc.get("expires_at", datetime.min.replace(tzinfo=UTC)) > datetime.now(UTC):
            return doc.get("audio_features")
    except Exception as exc:
        logger.warning({"event": "artist_feature_cache_read_failed", "error": str(exc)})
    return None


def cache_features(artist_name: str, features: dict) -> None:
    """Persist audio features for an artist."""
    if _mongo is None or not features:
        return
    try:
        slug = _artist_slug(artist_name)
        _mongo.db.artist_features.update_one(
            {"artist_slug": slug},
            {"$set": {
                "artist_slug": slug,
                "artist_name": artist_name,
                "audio_features": features,
                "cached_at":  datetime.now(UTC).isoformat(),
                "expires_at": datetime.now(UTC) + timedelta(days=CACHE_TTL_DAYS),
            }},
            upsert=True,
        )
    except Exception as exc:
        logger.warning({"event": "artist_feature_cache_write_failed", "error": str(exc)})


def enrich_artist_features(
    artists: list[dict],
    spotify_token: str | None = None,
) -> tuple[list[dict], float]:
    """
    For each artist without audio_features, try the cache then (optionally)
    Spotify search.  Returns (enriched_artists, semantic_coverage).

    semantic_coverage = fraction of artists that have real audio features
    after enrichment.

    Never raises. All errors are caught.
    """
    if not artists:
        return artists, 0.0

    enriched = []
    have_features = 0

    for artist in artists:
        if not isinstance(artist, dict):
            enriched.append(artist)
            continue

        existing_af = artist.get("audio_features") or artist.get("audioFeatures") or {}
        has_real    = bool(isinstance(existing_af, dict) and any(
            existing_af.get(k) is not None
            for k in ("energy", "valence", "danceability", "acousticness")
        ))

        if has_real:
            have_features += 1
            enriched.append(artist)
            continue

        # Try cache
        name    = artist.get("name") or ""
        cached  = get_cached_features(name) if name else None
        if cached:
            have_features += 1
            enriched.append({**artist, "audio_features": cached, "_feature_source": "cache"})
            continue

        # Try Spotify search + audio features
        if spotify_token and name:
            try:
                af = _fetch_spotify_features_for_artist(name, spotify_token)
                if af:
                    cache_features(name, af)
                    have_features += 1
                    enriched.append({**artist, "audio_features": af, "_feature_source": "spotify_enrich"})
                    continue
            except Exception as exc:
                logger.warning({"event": "spotify_artist_enrich_failed", "artist": name, "error": str(exc)})

        enriched.append(artist)

    coverage = have_features / max(len(artists), 1)
    return enriched, round(coverage, 3)


def _fetch_spotify_features_for_artist(artist_name: str, token: str) -> dict | None:
    """
    Search Spotify for the artist's top track, then fetch audio features.
    Returns audio features dict or None.
    Only called when Spotify token is available.
    """
    import urllib.parse
    import urllib.request
    import json

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }

    # Step 1: Search for top track by artist
    query   = urllib.parse.quote(f"artist:{artist_name}")
    url     = f"https://api.spotify.com/v1/search?q={query}&type=track&limit=3&market=US"
    req     = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body   = json.loads(resp.read().decode())
            items  = body.get("tracks", {}).get("items", [])
            if not items:
                return None
            track_id = items[0]["id"]
    except Exception:
        return None

    # Step 2: Fetch audio features for that track
    url2 = f"https://api.spotify.com/v1/audio-features/{track_id}"
    req2 = urllib.request.Request(url2, headers=headers)
    try:
        with urllib.request.urlopen(req2, timeout=5) as resp:
            af = json.loads(resp.read().decode())
            if af and af.get("energy") is not None:
                return {
                    "energy":         af.get("energy"),
                    "valence":        af.get("valence"),
                    "danceability":   af.get("danceability"),
                    "acousticness":   af.get("acousticness"),
                    "instrumentalness": af.get("instrumentalness"),
                    "tempo":          af.get("tempo"),
                    "_source":        "spotify_track_proxy",
                }
    except Exception:
        pass

    return None

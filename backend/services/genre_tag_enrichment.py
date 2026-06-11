"""
genre_tag_enrichment.py
-----------------------
Silent, server-side genre recovery via the Last.fm PUBLIC API.

Spotify stopped returning artist genres (empty genres[] on artist objects), which
starved genres, aesthetic tags, galaxy genre nodes, diversity, personality and
MBTI inputs. Last.fm artist top-tags are public data — only the app API key, no
user auth — so the profile build looks up tags for the artists the user already
provided. The user never sees Last.fm; the Spotify login flow is untouched.

Safety rules (the lesson of the pipeline arc):
  - Best-effort only: any failure logs a warning and returns input unchanged.
  - Hard wall-clock budget + per-call timeout + consecutive-failure circuit
    breaker, so a slow or dead Last.fm can NEVER stall the profile build.
  - Cache is keyed BY ARTIST, not by user — tags are identical for everyone.
    Mongo collection `artist_genre_tags` with a long TTL, plus a small
    in-process cache. After warm-up most builds touch Last.fm zero times.
"""
from __future__ import annotations

import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import UTC, datetime, timedelta

import requests

from config import Config
from utils.logger import logger

LASTFM_API = 'https://ws.audioscrobbler.com/2.0/'

_TAG_TTL_DAYS = 180
_PER_CALL_TIMEOUT = 4
_WALL_CLOCK_BUDGET_SECONDS = 8
_MAX_CONSECUTIVE_FAILURES = 3
_MAX_WORKERS = 4
# Last.fm normalizes tag counts to 0-100 per artist; below this the tag is noise.
_MIN_TAG_WEIGHT = 10
_MAX_TAGS_PER_ARTIST = 5
_MEMORY_CACHE_MAX = 4096

# Community tags that are not genres/moods. Kept small and lowercase.
_JUNK_TAGS = {
    'seen live', 'favorites', 'favourites', 'favorite', 'favourite',
    'spotify', 'check out', 'all', 'albums i own', 'vinyl', 'love', 'loved',
    'beautiful', 'awesome', 'amazing', 'epic', 'good', 'best', 'cool',
    'female vocalists', 'male vocalists', 'singer-songwriter favorites',
    'under 2000 listeners', '<3', 'sexy', 'usa', 'uk', 'british', 'american',
}

_mongo = None
_memory_cache: dict[str, list[str]] = {}


def init_mongo(mongo_instance) -> None:
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.artist_genre_tags.create_index('artist_slug', unique=True)
    except Exception:
        pass


def _slug(name: str) -> str:
    return name.lower().strip()


def _remember(slug: str, tags: list[str]) -> None:
    if len(_memory_cache) >= _MEMORY_CACHE_MAX:
        _memory_cache.clear()
    _memory_cache[slug] = tags


def get_cached_tags(artist_name: str) -> list[str] | None:
    """Cached tags for an artist, or None when absent/expired. Never raises."""
    slug = _slug(artist_name)
    if not slug:
        return None
    if slug in _memory_cache:
        return _memory_cache[slug]
    if _mongo is None:
        return None
    try:
        doc = _mongo.db.artist_genre_tags.find_one({'artist_slug': slug})
        if doc and doc.get('expires_at', datetime.min.replace(tzinfo=UTC)).replace(tzinfo=UTC) > datetime.now(UTC):
            tags = doc.get('tags') or []
            _remember(slug, tags)
            return tags
    except Exception as exc:
        logger.warning({'event': 'genre_tag_cache_read_failed', 'error': str(exc)})
    return None


def cache_tags(artist_name: str, tags: list[str]) -> None:
    slug = _slug(artist_name)
    if not slug:
        return
    _remember(slug, tags)
    if _mongo is None:
        return
    try:
        _mongo.db.artist_genre_tags.update_one(
            {'artist_slug': slug},
            {'$set': {
                'artist_slug': slug,
                'artist_name': artist_name,
                'tags': tags,
                'cached_at': datetime.now(UTC),
                'expires_at': datetime.now(UTC) + timedelta(days=_TAG_TTL_DAYS),
            }},
            upsert=True,
        )
    except Exception as exc:
        logger.warning({'event': 'genre_tag_cache_write_failed', 'error': str(exc)})


def _filter_tags(raw_tags: list[dict]) -> list[str]:
    tags: list[str] = []
    for tag in raw_tags:
        name = str(tag.get('name') or '').lower().strip()
        try:
            weight = int(tag.get('count') or 0)
        except (TypeError, ValueError):
            weight = 0
        if not name or name in _JUNK_TAGS or weight < _MIN_TAG_WEIGHT:
            continue
        tags.append(name)
        if len(tags) >= _MAX_TAGS_PER_ARTIST:
            break
    return tags


def fetch_lastfm_tags(artist_name: str) -> list[str] | None:
    """One artist.getTopTags call. Returns filtered tags, or None on failure
    (None = do not cache; [] = artist genuinely has no usable tags, cacheable)."""
    if not Config.lastfm_api_key:
        return None
    try:
        resp = requests.get(LASTFM_API, params={
            'method': 'artist.getTopTags',
            'artist': artist_name,
            'autocorrect': 1,
            'api_key': Config.lastfm_api_key,
            'format': 'json',
        }, timeout=_PER_CALL_TIMEOUT)
        if not resp.ok:
            return None
        data = resp.json()
        if 'error' in data:
            # Unknown artist etc. — a real answer, cache the emptiness.
            return []
        return _filter_tags(data.get('toptags', {}).get('tag', []) or [])
    except Exception:
        return None


def enrich_artist_genres_via_lastfm(artists: list[dict]) -> tuple[list[dict], dict]:
    """
    Fill genres[] from Last.fm tags for every artist that lacks them.
    Returns (artists, diagnostics). Never raises; on any failure the input
    passes through unchanged.
    """
    diagnostics: dict = {
        'source': 'lastfm_tags',
        'eligible': 0,
        'cacheHits': 0,
        'fetched': 0,
        'failed': 0,
        'gaveUp': False,
    }
    if not artists:
        return artists, diagnostics
    if not Config.lastfm_api_key:
        diagnostics['source'] = 'unconfigured'
        return artists, diagnostics

    start = time.time()
    enriched = [dict(artist) if isinstance(artist, dict) else artist for artist in artists]

    # Pass 1 — cache. Free, so it always runs to completion.
    need_fetch: list[tuple[int, str]] = []
    for index, artist in enumerate(enriched):
        if not isinstance(artist, dict) or artist.get('genres'):
            continue
        name = (artist.get('name') or '').strip()
        if not name:
            continue
        diagnostics['eligible'] += 1
        cached = get_cached_tags(name)
        if cached is not None:
            if cached:
                artist['genres'] = cached
                artist['_genre_source'] = 'lastfm_cache'
            diagnostics['cacheHits'] += 1
        else:
            need_fetch.append((index, name))

    # Pass 2 — bounded live fetch for cache misses.
    if need_fetch:
        consecutive_failures = 0
        pool = ThreadPoolExecutor(max_workers=_MAX_WORKERS)
        try:
            pending = {pool.submit(fetch_lastfm_tags, name): (index, name) for index, name in need_fetch}
            while pending:
                remaining = _WALL_CLOCK_BUDGET_SECONDS - (time.time() - start)
                if remaining <= 0 or consecutive_failures >= _MAX_CONSECUTIVE_FAILURES:
                    diagnostics['gaveUp'] = True
                    break
                done, _ = wait(list(pending), timeout=remaining, return_when=FIRST_COMPLETED)
                if not done:
                    continue
                for future in done:
                    index, name = pending.pop(future)
                    tags = future.result() if not future.cancelled() else None
                    if tags is None:
                        diagnostics['failed'] += 1
                        consecutive_failures += 1
                        if consecutive_failures >= _MAX_CONSECUTIVE_FAILURES:
                            # Circuit open: Last.fm is down/throttled — stop
                            # consuming results immediately, not at next loop top.
                            diagnostics['gaveUp'] = True
                            pending.clear()
                            break
                        continue
                    consecutive_failures = 0
                    diagnostics['fetched'] += 1
                    cache_tags(name, tags)
                    if tags:
                        enriched[index]['genres'] = tags
                        enriched[index]['_genre_source'] = 'lastfm'
        except Exception as exc:
            logger.warning({'event': 'lastfm_genre_enrichment_failed', 'error': str(exc)})
        finally:
            # Never wait for stragglers: queued calls are cancelled, in-flight
            # ones die on their own 4s timeout in a daemon-friendly pool thread.
            pool.shutdown(wait=False, cancel_futures=True)

    diagnostics['resolved'] = sum(1 for artist in enriched if isinstance(artist, dict) and artist.get('genres'))
    diagnostics['elapsedMs'] = round((time.time() - start) * 1000)
    return enriched, diagnostics

"""
audio_features_service.py
-------------------------
Provider-agnostic recovery of per-track audio features after Spotify
deprecated /audio-features (hard 403, permanent).

Public entry point:

    get_audio_features_for_tracks(tracks) -> (rows, diagnostics)

where ``tracks`` is the builder's normalized track list ({'id': spotify_id,
'title', 'artist', ...}) and ``rows`` come back in the exact schema the
profile build already consumes ({'id', 'energy', 'valence', 'danceability',
'acousticness', 'instrumentalness', 'speechiness', 'tempo', 'loudness'}).

The actual provider sits behind an adapter chosen by the single config point
``Config.audio_features_provider`` (env AUDIO_FEATURES_PROVIDER, default
'reccobeats'), so it can be swapped without touching the build.

Values from open analyzers (Essentia-family models) are close to but NOT
byte-identical with Spotify's old numbers, so every row is range-clamped at
this boundary (unit features to 0..1, tempo and loudness to sane windows) —
downstream thresholds (mood bands, MBTI midpoints, orb color) stay valid.

Cache: Mongo `track_audio_features`, keyed by Spotify track id, PERMANENT —
a track's features never change and are identical for every user, so a track
costs at most one provider call globally. Provider misses are negative-cached
for a couple of weeks so unknown tracks don't re-hit a flaky provider on
every build.

Safety rules (the lesson of the pipeline arc): best-effort only, per-call
timeout, hard wall-clock budget, bail on first hard failure, never raise.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import requests

from config import Config
from utils.logger import logger

_PER_CALL_TIMEOUT = 6
_WALL_CLOCK_BUDGET_SECONDS = 12
_NEGATIVE_TTL = timedelta(days=14)

_UNIT_KEYS = ('energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'speechiness')

_mongo = None


def init_mongo(mongo_instance) -> None:
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.track_audio_features.create_index('track_id', unique=True)
    except Exception:
        pass


def _clamp(value, lo: float, hi: float):
    try:
        return min(hi, max(lo, float(value)))
    except (TypeError, ValueError):
        return None


def _normalize_row(track_id: str, raw: dict) -> dict | None:
    """Builder-schema row with every value clamped to the ranges the
    downstream thresholds assume. None when nothing usable came back."""
    row = {'id': track_id}
    for key in _UNIT_KEYS:
        row[key] = _clamp(raw.get(key), 0.0, 1.0)
    row['tempo'] = _clamp(raw.get('tempo'), 0.0, 300.0)
    row['loudness'] = _clamp(raw.get('loudness'), -60.0, 5.0)
    has_signal = any(row[key] is not None for key in _UNIT_KEYS)
    return row if has_signal else None


# ── Providers ────────────────────────────────────────────────────────────────

class ReccoBeatsProvider:
    """Free audio-features API that accepts Spotify track ids directly.
    https://reccobeats.com — features derive from open audio models."""

    name = 'reccobeats'
    batch_size = 40

    def fetch(self, track_ids: list[str]) -> dict[str, dict] | None:
        """One batch call. Returns {spotify_id: raw_features}, or None on a
        hard failure (timeout / non-200 / unparseable)."""
        try:
            resp = requests.get(
                'https://api.reccobeats.com/v1/audio-features',
                params={'ids': ','.join(track_ids)},
                headers={'Accept': 'application/json'},
                timeout=_PER_CALL_TIMEOUT,
            )
            if not resp.ok:
                logger.warning({'event': 'reccobeats_fetch_failed', 'status': resp.status_code, 'body': resp.text[:200]})
                return None
            payload = resp.json()
        except Exception as exc:
            logger.warning({'event': 'reccobeats_fetch_failed', 'error': str(exc)})
            return None

        items = payload.get('content') if isinstance(payload, dict) else payload
        results: dict[str, dict] = {}
        requested = set(track_ids)
        for item in items or []:
            if not isinstance(item, dict):
                continue
            # ReccoBeats returns its own UUID in `id`; the Spotify id lives in
            # `href` ("https://open.spotify.com/track/<id>"). Be liberal: accept
            # either, but only map ids we actually asked for.
            spotify_id = None
            href = str(item.get('href') or '')
            if '/track/' in href:
                spotify_id = href.rsplit('/track/', 1)[-1].split('?')[0].strip('/')
            if spotify_id not in requested:
                candidate = str(item.get('id') or '')
                spotify_id = candidate if candidate in requested else None
            if spotify_id:
                results[spotify_id] = item
        return results


_PROVIDERS = {
    ReccoBeatsProvider.name: ReccoBeatsProvider(),
}


def _active_provider():
    name = (getattr(Config, 'audio_features_provider', None) or 'reccobeats').lower()
    return _PROVIDERS.get(name)


# ── Cache ────────────────────────────────────────────────────────────────────

def _cache_lookup(track_ids: list[str]) -> tuple[dict[str, dict], set[str]]:
    """Returns (features_by_id, negative_ids). Never raises."""
    if _mongo is None or not track_ids:
        return {}, set()
    features: dict[str, dict] = {}
    negative: set[str] = set()
    try:
        now = datetime.now(UTC)
        for doc in _mongo.db.track_audio_features.find({'track_id': {'$in': track_ids}}):
            track_id = doc.get('track_id')
            if doc.get('features'):
                features[track_id] = doc['features']
            else:
                # Negative entry — honored only while fresh.
                checked = doc.get('checked_at')
                if checked and checked.replace(tzinfo=UTC) > now - _NEGATIVE_TTL:
                    negative.add(track_id)
    except Exception as exc:
        logger.warning({'event': 'track_feature_cache_read_failed', 'error': str(exc)})
    return features, negative


def _cache_store(rows: dict[str, dict | None], provider_name: str) -> None:
    if _mongo is None or not rows:
        return
    try:
        now = datetime.now(UTC)
        for track_id, features in rows.items():
            self_doc = {
                'track_id': track_id,
                'features': features,
                'provider': provider_name,
                'checked_at': now,
            }
            _mongo.db.track_audio_features.update_one(
                {'track_id': track_id}, {'$set': self_doc}, upsert=True,
            )
    except Exception as exc:
        logger.warning({'event': 'track_feature_cache_write_failed', 'error': str(exc)})


# ── Entry point ──────────────────────────────────────────────────────────────

def get_audio_features_for_tracks(tracks: list[dict]) -> tuple[list[dict], dict]:
    """
    Resolve audio features for the given tracks: cache first, then the active
    provider for the remainder, inside a hard wall-clock budget. Coverage gaps
    are expected and fine — uncovered tracks simply don't contribute.
    Never raises.
    """
    start = time.time()
    track_ids = [track.get('id') for track in tracks if isinstance(track, dict) and track.get('id')]
    diagnostics: dict = {
        'requested': len(track_ids),
        'cacheHits': 0,
        'negativeCacheHits': 0,
        'fetched': 0,
        'uncovered': 0,
        'provider': None,
        'gaveUp': False,
    }
    if not track_ids:
        return [], diagnostics

    cached, negative = _cache_lookup(track_ids)
    diagnostics['cacheHits'] = len(cached)
    diagnostics['negativeCacheHits'] = len(negative)

    rows: list[dict] = []
    for track_id, features in cached.items():
        normalized = _normalize_row(track_id, features)
        if normalized:
            rows.append(normalized)

    missing = [tid for tid in track_ids if tid not in cached and tid not in negative]
    provider = _active_provider()
    if provider is None:
        diagnostics['provider'] = 'unconfigured'
        diagnostics['uncovered'] = len(missing)
        return rows, diagnostics
    diagnostics['provider'] = provider.name

    fetched_any_batch = False
    for offset in range(0, len(missing), provider.batch_size):
        if (time.time() - start) > _WALL_CLOCK_BUDGET_SECONDS:
            diagnostics['gaveUp'] = True
            break
        batch = missing[offset:offset + provider.batch_size]
        batch_result = provider.fetch(batch)
        if batch_result is None:
            # Hard provider failure — the rest of the batches will fail the
            # same way. Bail now; cache stays untouched for these ids so the
            # next build retries.
            diagnostics['gaveUp'] = True
            break
        fetched_any_batch = True
        store: dict[str, dict | None] = {}
        for track_id in batch:
            raw = batch_result.get(track_id)
            normalized = _normalize_row(track_id, raw) if raw else None
            if normalized:
                rows.append(normalized)
                diagnostics['fetched'] += 1
                store[track_id] = {key: normalized[key] for key in normalized if key != 'id'}
            else:
                store[track_id] = None  # negative-cache the miss
        _cache_store(store, provider.name)

    diagnostics['uncovered'] = max(0, len(track_ids) - len(rows))
    diagnostics['elapsedMs'] = round((time.time() - start) * 1000)
    if fetched_any_batch or diagnostics['cacheHits']:
        diagnostics['source'] = (
            f'{provider.name}_cache' if not fetched_any_batch else provider.name
        )
    return rows, diagnostics

"""
Pinterest Aesthetic route
-------------------------
POST /api/pinterest-aesthetic

Accepts the user's top genres + personality archetypes, builds Pinterest
search queries, calls the Pinterest v5 API, and returns up to 20 pins.

Falls back to Unsplash (already used by aesthetic.py) when the Pinterest
access token is not configured.
"""

from flask import Blueprint, jsonify, request
from middleware.rate_limit import rate_limit
from config import Config
from utils.logger import logger
import requests as req

pinterest_bp = Blueprint('pinterest_aesthetic', __name__)

PINTEREST_API = 'https://api.pinterest.com/v5'

# Simple in-memory cache keyed by query string
_cache: dict[str, list[dict]] = {}


def _build_queries(genres: list[str], archetypes: list[str]) -> list[str]:
    """Generate Pinterest search queries from genres and personality archetypes."""
    queries = []

    # Genre-based queries
    for g in genres[:4]:
        queries.append(f'{g} aesthetic')
        queries.append(f'{g} music aesthetic')

    # Archetype-based queries
    archetype_map = {
        'dreamy':     ['dreamy aesthetic', 'ethereal music aesthetic'],
        'nostalgic':  ['nostalgic aesthetic', 'vintage music aesthetic'],
        'chaotic':    ['chaotic energy aesthetic', 'intense music aesthetic'],
        'romantic':   ['romantic aesthetic', 'soft music aesthetic'],
        'melancholic':['melancholic aesthetic', 'sad music aesthetic'],
        'cosmic':     ['cosmic aesthetic', 'ambient music aesthetic'],
    }
    for a in archetypes[:3]:
        queries.extend(archetype_map.get(a.lower(), [f'{a} aesthetic']))

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            unique.append(q)

    return unique[:8]


def _fetch_pinterest(queries: list[str], per_query: int = 5) -> list[dict]:
    token = Config.PINTEREST_ACCESS_TOKEN
    if not token:
        return []

    pins, seen_ids = [], set()
    headers = {'Authorization': f'Bearer {token}'}

    for query in queries:
        if query in _cache:
            for p in _cache[query]:
                if p['id'] not in seen_ids:
                    seen_ids.add(p['id'])
                    pins.append(p)
            continue

        try:
            resp = req.get(
                f'{PINTEREST_API}/search/pins',
                params={'query': query, 'page_size': per_query},
                headers=headers,
                timeout=6,
            )
            if resp.status_code != 200:
                logger.warning({'event': 'pinterest_error', 'status': resp.status_code, 'query': query})
                continue

            items = resp.json().get('items', [])
            tag_pins = []
            for item in items:
                media = item.get('media', {})
                images = media.get('images', {})
                img_url = (
                    images.get('600x', {}).get('url') or
                    images.get('400x300', {}).get('url') or
                    images.get('150x150', {}).get('url') or ''
                )
                if not img_url:
                    continue

                pin = {
                    'id':          item.get('id', ''),
                    'title':       item.get('title') or query,
                    'description': item.get('description') or query,
                    'image':       img_url,
                    'thumb':       images.get('150x150', {}).get('url') or img_url,
                    'link':        f"https://www.pinterest.com/pin/{item.get('id', '')}",
                    'query':       query,
                }
                tag_pins.append(pin)
                if pin['id'] not in seen_ids:
                    seen_ids.add(pin['id'])
                    pins.append(pin)

            _cache[query] = tag_pins

        except Exception as e:
            logger.error({'event': 'pinterest_fetch_error', 'err': str(e), 'query': query})
            continue

    return pins


def _fallback_unsplash(queries: list[str], per_query: int = 4) -> list[dict]:
    """Use Unsplash as fallback when Pinterest token is absent."""
    if not Config.UNSPLASH_ACCESS_KEY:
        return _placeholder_images(queries)

    pins, seen_ids = [], set()
    for query in queries[:5]:
        try:
            resp = req.get(
                'https://api.unsplash.com/search/photos',
                params={'query': query, 'per_page': per_query, 'orientation': 'portrait'},
                headers={'Authorization': f'Client-ID {Config.UNSPLASH_ACCESS_KEY}'},
                timeout=5,
            )
            if resp.status_code != 200:
                continue
            for photo in resp.json().get('results', []):
                pid = photo['id']
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
                pins.append({
                    'id':          pid,
                    'title':       photo.get('description') or query,
                    'description': photo.get('alt_description') or query,
                    'image':       photo['urls']['regular'],
                    'thumb':       photo['urls']['small'],
                    'link':        photo['links']['html'],
                    'query':       query,
                })
        except Exception:
            continue
    return pins


def _placeholder_images(queries: list[str]) -> list[dict]:
    pins = []
    for i, q in enumerate(queries[:20]):
        w, h = 400 + (i % 3) * 100, 500 + (i % 4) * 80
        seed = abs(hash(q)) % 9999
        pins.append({
            'id':          f'placeholder-{i}',
            'title':       q,
            'description': q,
            'image':       f'https://picsum.photos/seed/{seed}/{w}/{h}',
            'thumb':       f'https://picsum.photos/seed/{seed}/300/200',
            'link':        f'https://www.pinterest.com/search/pins/?q={req.utils.quote(q)}',
            'query':       q,
        })
    return pins


@pinterest_bp.route('/api/pinterest-aesthetic', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_pinterest_aesthetic():
    data       = request.json or {}
    genres     = data.get('genres', [])
    archetypes = data.get('archetypes', [])

    queries = _build_queries(genres, archetypes)

    # Try Pinterest first, fall back to Unsplash, then placeholders
    pins = _fetch_pinterest(queries)
    if not pins:
        pins = _fallback_unsplash(queries)

    return jsonify({
        'pins':    pins[:20],
        'queries': queries,
        'source':  'pinterest' if Config.PINTEREST_ACCESS_TOKEN else ('unsplash' if Config.UNSPLASH_ACCESS_KEY else 'placeholder'),
    }), 200

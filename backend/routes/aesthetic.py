"""
Aesthetic routes:
  POST /api/aesthetic              — generate full aesthetic board
  POST /api/aesthetic/regenerate   — regenerate with seed offset
  POST /api/aesthetic/personality  — music personality profile only
"""
from pathlib import Path
import sys

from flask import Blueprint, request, jsonify
from middleware.rate_limit import rate_limit
from config import Config
import requests as req
from utils.api import api_success_legacy

try:
    from ml.aesthetic_engine import (
        build_aesthetic_report,
        generate_personality,
        generate_shared_aesthetic,
        classify_vibe,
        generate_poetic_persona,
        extract_palette_from_features,
    )
except ModuleNotFoundError:
    backend_root = Path(__file__).resolve().parent.parent
    backend_root_str = str(backend_root)
    if backend_root_str not in sys.path:
        sys.path.insert(0, backend_root_str)
    from ml.aesthetic_engine import (
        build_aesthetic_report,
        generate_personality,
        generate_shared_aesthetic,
        classify_vibe,
        generate_poetic_persona,
        extract_palette_from_features,
    )

aesthetic_bp = Blueprint('aesthetic', __name__)

# In-memory image cache keyed by tag string
_image_cache: dict[str, list[dict]] = {}

UNSPLASH_BASE = 'https://api.unsplash.com'


def _fetch_unsplash_images(tags: list[str], per_tag: int = 4) -> list[dict]:
    images, seen_ids = [], set()
    for tag in tags[:6]:
        if tag in _image_cache:
            for img in _image_cache[tag]:
                if img['id'] not in seen_ids:
                    seen_ids.add(img['id'])
                    images.append(img)
            continue
        try:
            resp = req.get(
                f'{UNSPLASH_BASE}/search/photos',
                params={'query': tag, 'per_page': per_tag, 'orientation': 'portrait'},
                headers={'Authorization': f'Client-ID {Config.unsplash_access_key}'},
                timeout=5,
            )
            if resp.status_code != 200:
                continue
            tag_images = []
            for photo in resp.json().get('results', []):
                img = {
                    'id':               photo['id'],
                    'url':              photo['urls']['regular'],
                    'thumb':            photo['urls']['small'],
                    'description':      photo.get('description') or photo.get('alt_description') or tag,
                    'photographer':     photo['user']['name'],
                    'photographer_url': photo['user']['links']['html'],
                    'unsplash_url':     photo['links']['html'],
                    'tag':              tag,
                    'width':            photo['width'],
                    'height':           photo['height'],
                }
                tag_images.append(img)
                if img['id'] not in seen_ids:
                    seen_ids.add(img['id'])
                    images.append(img)
            _image_cache[tag] = tag_images
        except Exception:
            continue
    return images


def _fallback_images(tags: list[str]) -> list[dict]:
    placeholders = []
    for i, tag in enumerate(tags[:16]):
        w = 400 + (i % 3) * 100
        h = 500 + (i % 4) * 80
        placeholders.append({
            'id':               f'placeholder-{i}',
            'url':              f'https://picsum.photos/seed/{abs(hash(tag)) % 9999}/{w}/{h}',
            'thumb':            f'https://picsum.photos/seed/{abs(hash(tag)) % 9999}/400/300',
            'description':      tag,
            'photographer':     'Picsum Photos',
            'photographer_url': 'https://picsum.photos',
            'unsplash_url':     'https://unsplash.com',
            'tag':              tag,
            'width':            w,
            'height':           h,
        })
    return placeholders


def _parse_body():
    if request.method == 'POST':
        data = request.json or {}
    else:
        data = request.args.to_dict()
        if 'genres' in data and isinstance(data['genres'], str):
            data['genres'] = [g.strip() for g in data['genres'].split(',') if g.strip()]
    return data


def _build_aesthetic(data: dict, seed_offset: int = 0) -> dict:
    report = build_aesthetic_report(data, seed_offset=seed_offset)
    tags = report.get('tags') or report.get('paletteHints') or [report.get('primaryAesthetic', {}).get('label', 'music aesthetic')]
    images = _fetch_unsplash_images(tags) if Config.unsplash_access_key else _fallback_images(tags)
    report['images'] = images
    return report


def _wrap_aesthetic_payload(payload: dict, *, warnings: list | None = None, limited_signal: bool | None = None):
    return api_success_legacy(
        payload,
        status=200,
        warnings=warnings or payload.get('warnings') or [],
        limitedSignal=limited_signal,
    )


@aesthetic_bp.route('/api/aesthetic', methods=['GET', 'POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_aesthetic():
    report = _build_aesthetic(_parse_body())
    limited = not report.get('palette') and not report.get('images')
    warnings = []
    if not Config.unsplash_access_key:
        warnings.append('fallback_images_used')
    return _wrap_aesthetic_payload(report, warnings=warnings, limited_signal=limited)


@aesthetic_bp.route('/api/aesthetic/regenerate', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def regenerate_aesthetic():
    data   = request.json or {}
    offset = int(data.pop('seed_offset', 1))
    report = _build_aesthetic(data, seed_offset=offset)
    warnings = []
    if not Config.unsplash_access_key:
        warnings.append('fallback_images_used')
    return _wrap_aesthetic_payload(report, warnings=warnings)


@aesthetic_bp.route('/api/aesthetic/personality', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def get_personality():
    data    = request.json or {}
    genres  = data.get('genres', [])
    energy  = data.get('energy')
    valence = data.get('valence')
    tempo   = data.get('tempo')
    payload = generate_personality(genres, energy, valence, tempo)
    return _wrap_aesthetic_payload(payload)


@aesthetic_bp.route('/api/aesthetic/shared', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_shared_aesthetic():
    data = request.json or {}
    tags_a          = data.get('tags_a', [])
    tags_b          = data.get('tags_b', [])
    shared_genres   = data.get('shared_genres', [])
    shared_artists  = data.get('shared_artists', [])

    shared = generate_shared_aesthetic(tags_a, tags_b, shared_genres, shared_artists)
    images = _fetch_unsplash_images(shared['shared_tags']) if Config.unsplash_access_key \
             else _fallback_images(shared['shared_tags'])
    shared['images'] = images
    warnings = []
    if not Config.unsplash_access_key:
        warnings.append('fallback_images_used')
    return _wrap_aesthetic_payload(shared, warnings=warnings)


@aesthetic_bp.route('/api/aesthetic/vibe', methods=['POST'])
@rate_limit(max_requests=60, window_seconds=60)
def get_vibe():
    """
    Map Spotify audio features → hyper-specific poetic vibe label + hex color.
    Body: { energy, valence, tempo, genres? }
    """
    data    = request.json or {}
    if data.get('energy') is None or data.get('valence') is None or data.get('tempo') is None:
        payload = {
            'label': 'Insufficient Data',
            'hex': '#7c6fff',
            'description': 'Spotify audio-feature coverage is too limited to classify a vibe safely.',
            'energy': None,
            'valence': None,
            'tempo': None,
        }
        return _wrap_aesthetic_payload(payload, warnings=['insufficient_audio_features'], limited_signal=True)
    energy  = float(data.get('energy'))
    valence = float(data.get('valence'))
    tempo   = float(data.get('tempo'))
    genres  = data.get('genres', [])
    return _wrap_aesthetic_payload(classify_vibe(energy, valence, tempo, genres))


@aesthetic_bp.route('/api/aesthetic/identity', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_identity():
    """
    Generate a full Music Identity Report with poetic persona.
    Body: { energy, valence, tempo, genres }
    """
    data    = request.json or {}
    genres  = data.get('genres', [])
    if data.get('energy') is None or data.get('valence') is None or data.get('tempo') is None:
        payload = {
            'name': 'Unresolved Identity',
            'tagline': 'There is not enough analyzable audio data yet.',
            'report': 'Melody Map needs stronger Spotify audio-feature coverage before it can confidently generate a poetic identity report.',
            'keywords': ['insufficient data'],
            'vibe': {
                'label': 'Insufficient Data',
                'hex': '#7c6fff',
                'description': 'Spotify audio-feature coverage is too limited to classify a vibe safely.',
                'energy': None,
                'valence': None,
                'tempo': None,
                'genres': genres,
            },
        }
        return _wrap_aesthetic_payload(payload, warnings=['insufficient_audio_features'], limited_signal=True)
    energy  = float(data.get('energy'))
    valence = float(data.get('valence'))
    tempo   = float(data.get('tempo'))
    return _wrap_aesthetic_payload(generate_poetic_persona(genres, energy, valence, tempo))


@aesthetic_bp.route('/api/aesthetic/palette-from-features', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def get_palette_from_features():
    """
    Extract a named color palette + Unsplash query from average audio features.
    Body: { average_valence, average_energy, genres? }
    Returns: { name, palette, unsplash_query, description, energy, valence, genre_override }
    """
    data    = request.json or {}
    if data.get('average_valence') is None or data.get('average_energy') is None:
        payload = {
            'name': 'Insufficient Data',
            'palette': ['#1a1a2e', '#3a0ca3', '#7209b7', '#f72585', '#4361ee'],
            'unsplash_query': 'abstract space nebula dark',
            'description': 'Spotify audio-feature coverage is too limited to infer a palette safely.',
            'energy': None,
            'valence': None,
            'genre_override': False,
            'images': _fallback_images(['abstract space nebula dark']),
        }
        return _wrap_aesthetic_payload(payload, warnings=['insufficient_audio_features'], limited_signal=True)
    valence = float(data.get('average_valence'))
    energy  = float(data.get('average_energy'))
    genres  = data.get('genres', [])
    result  = extract_palette_from_features(valence, energy, genres)

    # Optionally fetch Unsplash images for the extracted palette
    if Config.unsplash_access_key:
        images = _fetch_unsplash_images([result['unsplash_query']], per_tag=6)
        result['images'] = images
    else:
        result['images'] = _fallback_images([result['unsplash_query']])

    warnings = []
    if not Config.unsplash_access_key:
        warnings.append('fallback_images_used')
    return _wrap_aesthetic_payload(result, warnings=warnings)

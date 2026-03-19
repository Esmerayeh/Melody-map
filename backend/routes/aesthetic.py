"""
Aesthetic routes:
  POST /api/aesthetic              — generate full aesthetic board
  POST /api/aesthetic/regenerate   — regenerate with seed offset
  POST /api/aesthetic/personality  — music personality profile only
"""
from flask import Blueprint, request, jsonify
from middleware.rate_limit import rate_limit
from ml.aesthetic_engine import (
    generate_aesthetic_tags,
    generate_aesthetic_name,
    generate_palette,
    generate_vibe_description,
    generate_personality,
    generate_shared_aesthetic,
    classify_vibe,
    generate_poetic_persona,
    extract_palette_from_features,
)
from config import Config
import requests as req

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
                headers={'Authorization': f'Client-ID {Config.UNSPLASH_ACCESS_KEY}'},
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
    genres       = data.get('genres', [])
    energy       = float(data.get('energy', 0.5))
    valence      = float(data.get('valence', 0.5))
    tempo        = float(data.get('tempo', 120))
    danceability = float(data.get('danceability', 0.5))
    top_artists  = data.get('top_artists', [])  # list of artist name strings
    personality_traits = data.get('personality_traits', [])

    tags        = generate_aesthetic_tags(genres, energy, valence, tempo, danceability,
                                          top_artists=top_artists,
                                          personality_traits=personality_traits)
    name        = generate_aesthetic_name(genres, energy, valence, seed_offset)
    palette     = generate_palette(genres, energy, valence)
    vibe        = generate_vibe_description(genres, energy, valence)
    personality = generate_personality(genres, energy, valence, tempo)

    images = _fetch_unsplash_images(tags) if Config.UNSPLASH_ACCESS_KEY else _fallback_images(tags)

    return {
        'aesthetic_name':   name,
        'palette':          palette,
        'tags':             tags,
        'vibe_description': vibe,
        'personality':      personality,
        'images':           images,
    }


@aesthetic_bp.route('/api/aesthetic', methods=['GET', 'POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_aesthetic():
    return jsonify(_build_aesthetic(_parse_body())), 200


@aesthetic_bp.route('/api/aesthetic/regenerate', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def regenerate_aesthetic():
    data   = request.json or {}
    offset = int(data.pop('seed_offset', 1))
    return jsonify(_build_aesthetic(data, seed_offset=offset)), 200


@aesthetic_bp.route('/api/aesthetic/personality', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def get_personality():
    data    = request.json or {}
    genres  = data.get('genres', [])
    energy  = float(data.get('energy', 0.5))
    valence = float(data.get('valence', 0.5))
    tempo   = float(data.get('tempo', 120))
    return jsonify(generate_personality(genres, energy, valence, tempo)), 200


@aesthetic_bp.route('/api/aesthetic/shared', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_shared_aesthetic():
    data = request.json or {}
    tags_a          = data.get('tags_a', [])
    tags_b          = data.get('tags_b', [])
    shared_genres   = data.get('shared_genres', [])
    shared_artists  = data.get('shared_artists', [])

    shared = generate_shared_aesthetic(tags_a, tags_b, shared_genres, shared_artists)
    images = _fetch_unsplash_images(shared['shared_tags']) if Config.UNSPLASH_ACCESS_KEY \
             else _fallback_images(shared['shared_tags'])
    shared['images'] = images
    return jsonify(shared), 200


@aesthetic_bp.route('/api/aesthetic/vibe', methods=['POST'])
@rate_limit(max_requests=60, window_seconds=60)
def get_vibe():
    """
    Map Spotify audio features → hyper-specific poetic vibe label + hex color.
    Body: { energy, valence, tempo, genres? }
    """
    data    = request.json or {}
    energy  = float(data.get('energy',  0.5))
    valence = float(data.get('valence', 0.5))
    tempo   = float(data.get('tempo',   120))
    genres  = data.get('genres', [])
    return jsonify(classify_vibe(energy, valence, tempo, genres)), 200


@aesthetic_bp.route('/api/aesthetic/identity', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def get_identity():
    """
    Generate a full Music Identity Report with poetic persona.
    Body: { energy, valence, tempo, genres }
    """
    data    = request.json or {}
    genres  = data.get('genres', [])
    energy  = float(data.get('energy',  0.5))
    valence = float(data.get('valence', 0.5))
    tempo   = float(data.get('tempo',   120))
    return jsonify(generate_poetic_persona(genres, energy, valence, tempo)), 200


@aesthetic_bp.route('/api/aesthetic/palette-from-features', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def get_palette_from_features():
    """
    Extract a named color palette + Unsplash query from average audio features.
    Body: { average_valence, average_energy, genres? }
    Returns: { name, palette, unsplash_query, description, energy, valence, genre_override }
    """
    data    = request.json or {}
    valence = float(data.get('average_valence', 0.5))
    energy  = float(data.get('average_energy',  0.5))
    genres  = data.get('genres', [])
    result  = extract_palette_from_features(valence, energy, genres)

    # Optionally fetch Unsplash images for the extracted palette
    if Config.UNSPLASH_ACCESS_KEY:
        images = _fetch_unsplash_images([result['unsplash_query']], per_tag=6)
        result['images'] = images
    else:
        result['images'] = _fallback_images([result['unsplash_query']])

    return jsonify(result), 200

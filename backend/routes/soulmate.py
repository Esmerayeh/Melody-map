"""
Soulmate routes
---------------
POST /api/soulmate/profile          — upsert the current user's taste profile
GET  /api/soulmate/matches          — return top-5 compatible users
GET  /api/soulmate/compare/<uid_b>  — full comparison between current user and uid_b
"""

from flask import Blueprint, jsonify, request, g
from flask_pymongo import PyMongo
from bson import ObjectId
from datetime import datetime
import re
from middleware.auth import require_auth
from middleware.rate_limit import rate_limit
from ml.soulmate_engine import soulmate_engine
from utils.logger import logger

soulmate_bp = Blueprint('soulmate', __name__)

# PyMongo instance injected at registration time (see app.py)
_mongo = None

def init_mongo(mongo_instance):
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.taste_profiles.create_index('user_id', unique=True)
        _mongo.db.taste_profiles.create_index('public_slug', unique=True, sparse=True)
    except Exception:
        pass


# ── Helpers ────────────────────────────────────────────────────────────────────

PLACEHOLDER_SLUG_VALUES = {'you', 'me', 'your-public-slug', 'unknown', 'user'}


def _clean_public_identity_value(value: str | None) -> str:
    candidate = (value or '').strip()
    lowered = candidate.lower()
    if not candidate or lowered in PLACEHOLDER_SLUG_VALUES:
        return ''
    return candidate


def _get_profile(user_id: str) -> dict | None:
    doc = _mongo.db.taste_profiles.find_one({'user_id': user_id})
    return doc


def _profile_to_engine_format(doc: dict) -> dict:
    """Convert a DB taste_profile doc to the format SoulmateEngine expects."""
    return {
        'user_id':  doc.get('user_id'),
        'username': doc.get('username', 'Unknown'),
        'avatar':   doc.get('avatar'),
        'artists':  doc.get('top_artists', []),
        'tracks':   doc.get('top_tracks',  []),
        'genres':   doc.get('genres',      []),
        'audio':    doc.get('audio_features', {}),
    }


def _build_public_slug(username: str | None, user_id: str) -> str:
    base = _clean_public_identity_value(username).lower()
    slug = re.sub(r'[^a-z0-9]+', '-', base).strip('-')
    fallback = f'user-{str(user_id)[-6:]}'
    return slug or fallback


def _ensure_public_slug(username: str | None, user_id: str) -> str:
    existing_profile = _get_profile(user_id)
    existing_slug = _clean_public_identity_value((existing_profile or {}).get('public_slug'))
    if existing_slug:
        return _build_public_slug(existing_slug, user_id)

    base_slug = _build_public_slug(username, user_id)
    slug = base_slug
    suffix = 2

    while True:
        existing = _mongo.db.taste_profiles.find_one({'public_slug': slug})
        if not existing or existing.get('user_id') == user_id:
            return slug
        slug = f'{base_slug}-{suffix}'
        suffix += 1


def _resolve_username(data: dict, user_id: str) -> str:
    provided = _clean_public_identity_value(data.get('username'))
    if provided:
        return provided

    user_doc = None
    try:
        user_doc = _mongo.db.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        user_doc = _mongo.db.users.find_one({'_id': user_id})

    doc_username = _clean_public_identity_value((user_doc or {}).get('username'))
    if doc_username:
        return doc_username

    for key in ('display_name', 'name', 'email'):
        candidate = _clean_public_identity_value((user_doc or {}).get(key))
        if candidate:
            return candidate.split('@')[0]

    return f'user-{str(user_id)[-6:]}'


# ── Routes ─────────────────────────────────────────────────────────────────────

@soulmate_bp.route('/soulmate/profile', methods=['POST'])
@require_auth
@rate_limit(max_requests=20, window_seconds=60)
def upsert_profile():
    """
    Store / update the current user's taste profile.
    Body:
      {
        "top_artists":     ["Artist A", "Artist B", ...],
        "top_tracks":      ["Track A", "Track B", ...],
        "genres":          ["indie", "shoegaze", ...],
        "audio_features":  { "energy": 0.7, "valence": 0.5, ... },
        "username":        "alice",
        "avatar":          "https://..."   (optional)
      }
    """
    data = request.json or {}
    user_id = g.user_id

    username = _resolve_username(data, user_id)

    profile = {
        'user_id':        user_id,
        'username':       username,
        'public_slug':    _ensure_public_slug(username, user_id),
        'avatar':         data.get('avatar'),
        'top_artists':    data.get('top_artists', [])[:50],
        'top_tracks':     data.get('top_tracks',  [])[:50],
        'genres':         data.get('genres',      [])[:50],
        'audio_features': data.get('audio_features', {}),
        'data_quality':   data.get('data_quality', {}),
        'confidence':     data.get('confidence', {}),
        'soulmate_readiness': data.get('soulmate_readiness', {}),
        'identity_readiness': data.get('identity_readiness', {}),
        'updated_at':     datetime.utcnow(),
    }

    _mongo.db.taste_profiles.update_one(
        {'user_id': user_id},
        {'$set': profile},
        upsert=True,
    )
    logger.info({'event': 'profile_upsert', 'user_id': user_id})
    public_url = f'/soulmate/{profile["public_slug"]}'
    return jsonify({
        'ok': True,
        'username': username,
        'public_slug': profile['public_slug'],
        'public_url': public_url,
        'data_quality': profile['data_quality'],
        'confidence': profile['confidence'],
        'soulmate_readiness': profile['soulmate_readiness'],
        'identity_readiness': profile['identity_readiness'],
    }), 200


@soulmate_bp.route('/soulmate/matches', methods=['GET'])
@require_auth
@rate_limit(max_requests=30, window_seconds=60)
def get_matches():
    """Return top-5 soulmate matches for the current user."""
    user_id = g.user_id
    my_doc  = _get_profile(user_id)

    if not my_doc:
        return jsonify({'error': 'Profile not found. Sync your music first.'}), 404

    my_profile = _profile_to_engine_format(my_doc)

    # Fetch all other profiles
    others = list(_mongo.db.taste_profiles.find({'user_id': {'$ne': user_id}}))
    if not others:
        return jsonify([]), 200

    other_profiles = [_profile_to_engine_format(o) for o in others]
    ranked = soulmate_engine.rank_matches(my_profile, other_profiles)
    return jsonify(ranked[:5]), 200


@soulmate_bp.route('/soulmate/compare/<uid_b>', methods=['GET'])
@require_auth
@rate_limit(max_requests=30, window_seconds=60)
def compare(uid_b: str):
    """Full comparison between the current user and uid_b."""
    user_id = g.user_id

    doc_a = _get_profile(user_id)
    doc_b = _get_profile(uid_b)

    if not doc_a:
        return jsonify({'error': 'Your profile not found. Sync your music first.'}), 404
    if not doc_b:
        return jsonify({'error': 'Other user profile not found.'}), 404

    profile_a = _profile_to_engine_format(doc_a)
    profile_b = _profile_to_engine_format(doc_b)

    result = soulmate_engine.compute_score(profile_a, profile_b)
    graph  = soulmate_engine.build_constellation_graph(
        profile_a, profile_b,
        user_a_name=profile_a['username'],
        user_b_name=profile_b['username'],
    )

    return jsonify({
        **result,
        'user_a': {'user_id': user_id,  'username': profile_a['username'], 'avatar': profile_a.get('avatar')},
        'user_b': {'user_id': uid_b,    'username': profile_b['username'], 'avatar': profile_b.get('avatar')},
        'graph':  graph,
    }), 200


@soulmate_bp.route('/soulmate/profile/me', methods=['GET'])
@require_auth
def get_my_profile():
    """Return the current user's stored taste profile."""
    doc = _get_profile(g.user_id)
    if not doc:
        return jsonify(None), 200
    doc['_id'] = str(doc['_id'])
    return jsonify(doc), 200

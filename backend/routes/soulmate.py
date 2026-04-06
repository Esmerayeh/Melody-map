"""
Soulmate routes
---------------
POST /api/soulmate/profile          — upsert the current user's taste profile
GET  /api/soulmate/matches          — return top-5 compatible users
GET  /api/soulmate/compare/<uid_b>  — full comparison between current user and uid_b
"""

from flask import Blueprint, jsonify, request, g
from datetime import datetime
import re
from middleware.auth import require_auth
from middleware.rate_limit import rate_limit
from ml.soulmate_engine import soulmate_engine
from utils.api import api_error, api_success_legacy
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
    if _mongo is None:
        return None
    doc = _mongo.db.taste_profiles.find_one({'user_id': user_id})
    return doc


def _get_profile_by_slug(slug: str) -> dict | None:
    if _mongo is None or not slug:
        return None
    doc = _mongo.db.taste_profiles.find_one({'public_slug': slug})
    if doc:
        return doc
    try:
        return _mongo.db.taste_profiles.find_one({
            'username': {'$regex': f'^{re.escape(slug)}$', '$options': 'i'}
        })
    except Exception:
        return None


def _profile_to_engine_format(doc: dict) -> dict:
    """Convert a DB taste_profile doc to the format SoulmateEngine expects."""
    return {
        'user_id':  doc.get('user_id'),
        'username': doc.get('username', 'Unknown'),
        'avatar':   doc.get('avatar'),
        'topArtists': doc.get('top_artists', []),
        'topTracks': doc.get('top_tracks',  []),
        'genres': doc.get('genres', []),
        'audioFeatures': doc.get('audio_features', {}),
        'audio': doc.get('audio_features', {}),
        'mbtiType': doc.get('mbti_type'),
        'mbti': doc.get('mbti_profile') or {},
        'mbtiProfile': doc.get('mbti_profile') or {},
        'sonicPersonalityTitle': doc.get('sonic_personality_title'),
        'personalityTraits': doc.get('personality_traits', []),
        'personality': doc.get('personality_traits', []),
        'personalityMeta': doc.get('personality_meta') or {},
        'archetype': doc.get('archetype'),
        'emotionalSignature': doc.get('emotional_signature'),
        'listeningStyle': doc.get('listening_style'),
        'traitScores': doc.get('trait_scores') or {},
        'musicIdentitySummary': doc.get('music_identity_summary'),
        'moodTags': doc.get('mood_tags', []),
        'aestheticTags': doc.get('aesthetic_tags', []),
        'atmosphereLabels': doc.get('atmosphere_labels', []),
        'regionLabels': doc.get('region_labels', []),
        'orbStateDescriptors': doc.get('orb_state_descriptors', []),
        'timeOfDayPatterns': doc.get('time_of_day_patterns', []),
        'eraPreferences': doc.get('era_preferences', []),
        'analyticsMetrics': doc.get('analytics_metrics') or {},
        'confidence': doc.get('confidence') or {},
        'dataQuality': doc.get('data_quality') or {},
        'profileTier': doc.get('profile_tier'),
        'audioCoverage': doc.get('audio_coverage'),
        'genreCoverage': doc.get('genre_coverage'),
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
        from bson import ObjectId
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
    if _mongo is None:
        return api_error('Database not initialised', 500, code='DATABASE_NOT_INITIALISED')

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
        'mbti_type': data.get('mbti_type'),
        'mbti_profile': data.get('mbti_profile') or {},
        'sonic_personality_title': data.get('sonic_personality_title'),
        'personality_traits': data.get('personality_traits', [])[:12],
        'personality_meta': data.get('personality_meta') or {},
        'archetype': data.get('archetype'),
        'emotional_signature': data.get('emotional_signature'),
        'listening_style': data.get('listening_style'),
        'trait_scores': data.get('trait_scores') or {},
        'music_identity_summary': data.get('music_identity_summary'),
        'mood_tags': data.get('mood_tags', [])[:16],
        'aesthetic_tags': data.get('aesthetic_tags', [])[:16],
        'atmosphere_labels': data.get('atmosphere_labels', [])[:16],
        'region_labels': data.get('region_labels', [])[:16],
        'orb_state_descriptors': data.get('orb_state_descriptors', [])[:12],
        'time_of_day_patterns': data.get('time_of_day_patterns', [])[:8],
        'era_preferences': data.get('era_preferences', [])[:8],
        'analytics_metrics': data.get('analytics_metrics') or {},
        'data_quality':   data.get('data_quality', {}),
        'confidence':     data.get('confidence', {}),
        'profile_tier': data.get('profile_tier'),
        'audio_coverage': data.get('audio_coverage'),
        'genre_coverage': data.get('genre_coverage'),
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
    payload = {
        'ok': True,
        'username': username,
        'public_slug': profile['public_slug'],
        'public_url': public_url,
        'data_quality': profile['data_quality'],
        'confidence': profile['confidence'],
        'soulmate_readiness': profile['soulmate_readiness'],
        'identity_readiness': profile['identity_readiness'],
    }
    return api_success_legacy(
        payload,
        status=200,
        confidence=payload.get('confidence'),
        dataQuality=payload.get('data_quality'),
        profileTier=profile.get('profile_tier'),
    )


@soulmate_bp.route('/soulmate/matches', methods=['GET'])
@require_auth
@rate_limit(max_requests=30, window_seconds=60)
def get_matches():
    """Return top-5 soulmate matches for the current user."""
    user_id = g.user_id
    my_doc  = _get_profile(user_id)

    if not my_doc:
        return api_error('Profile not found. Sync your music first.', 404, code='PROFILE_NOT_FOUND')

    my_profile = _profile_to_engine_format(my_doc)

    # Fetch all other profiles
    others = list(_mongo.db.taste_profiles.find({'user_id': {'$ne': user_id}}))
    if not others:
        return api_success_legacy([], status=200, warnings=['no_matches'])

    other_profiles = [_profile_to_engine_format(o) for o in others]
    ranked = soulmate_engine.rank_matches(my_profile, other_profiles)
    return api_success_legacy(ranked[:5], status=200)


@soulmate_bp.route('/soulmate/compare/<uid_b>', methods=['GET'])
@require_auth
@rate_limit(max_requests=30, window_seconds=60)
def compare(uid_b: str):
    """Full comparison between the current user and uid_b."""
    user_id = g.user_id

    doc_a = _get_profile(user_id)
    doc_b = _get_profile(uid_b)

    if not doc_a:
        return api_error('Your profile not found. Sync your music first.', 404, code='PROFILE_NOT_FOUND')
    if not doc_b:
        return api_error('Other user profile not found.', 404, code='PROFILE_NOT_FOUND')

    profile_a = _profile_to_engine_format(doc_a)
    profile_b = _profile_to_engine_format(doc_b)

    result = soulmate_engine.compute_score(profile_a, profile_b)
    graph  = soulmate_engine.build_constellation_graph(
        profile_a, profile_b,
        user_a_name=profile_a['username'],
        user_b_name=profile_b['username'],
    )

    comparison = {
        **result,
        'user_a': {'user_id': user_id,  'username': profile_a['username'], 'avatar': profile_a.get('avatar')},
        'user_b': {'user_id': uid_b,    'username': profile_b['username'], 'avatar': profile_b.get('avatar')},
        'profile_a': profile_a,
        'profile_b': profile_b,
        'graph':  graph,
    }
    return api_success_legacy(
        comparison,
        status=200,
        confidence=result.get('confidence'),
        dataQuality=doc_a.get('data_quality'),
        profileTier=doc_a.get('profile_tier'),
        warnings=result.get('warnings'),
    )


@soulmate_bp.route('/soulmate/compare-public/<slug>', methods=['GET'])
@require_auth
@rate_limit(max_requests=30, window_seconds=60)
def compare_public(slug: str):
    """Full comparison between the current user and a public slug."""
    user_id = g.user_id
    normalized_slug = (slug or '').strip()

    doc_a = _get_profile(user_id)
    doc_b = _get_profile_by_slug(normalized_slug)

    if not doc_a:
        return api_error('Your profile not found. Sync your music first.', 404, code='PROFILE_NOT_FOUND')
    if not doc_b:
        return api_error('Other user profile not found.', 404, code='PROFILE_NOT_FOUND')

    profile_a = _profile_to_engine_format(doc_a)
    profile_b = _profile_to_engine_format(doc_b)

    result = soulmate_engine.compute_score(profile_a, profile_b)
    graph = soulmate_engine.build_constellation_graph(
        profile_a, profile_b,
        user_a_name=profile_a['username'],
        user_b_name=profile_b['username'],
    )

    comparison = {
        **result,
        'user_a': {'user_id': user_id, 'username': profile_a['username'], 'avatar': profile_a.get('avatar')},
        'user_b': {'user_id': profile_b.get('user_id'), 'username': profile_b['username'], 'avatar': profile_b.get('avatar')},
        'profile_a': profile_a,
        'profile_b': profile_b,
        'graph': graph,
    }
    return api_success_legacy(
        comparison,
        status=200,
        confidence=result.get('confidence'),
        dataQuality=doc_a.get('data_quality'),
        profileTier=doc_a.get('profile_tier'),
        warnings=result.get('warnings'),
    )


@soulmate_bp.route('/soulmate/profile/me', methods=['GET'])
@require_auth
def get_my_profile():
    """Return the current user's stored taste profile."""
    doc = _get_profile(g.user_id)
    if not doc:
        return api_success_legacy(None, status=200, warnings=['profile_missing'])
    doc['_id'] = str(doc['_id'])
    return api_success_legacy(
        doc,
        status=200,
        confidence=doc.get('confidence'),
        dataQuality=doc.get('data_quality'),
        profileTier=doc.get('profile_tier'),
    )

from __future__ import annotations

import re

from flask import Blueprint, g, request

from middleware.auth import require_auth
from middleware.rate_limit import rate_limit
from ml.soulmate_engine import soulmate_engine
from services.feature_store import (
    accept_soulmate_request,
    create_soulmate_request,
    get_latest_snapshot,
    get_social_public_profile,
    get_social_public_profile_by_slug,
    list_social_public_profiles,
    list_soulmate_requests,
    upsert_social_public_profile,
    upsert_soulmate_match,
)
from utils.api import api_error, api_success

social_bp = Blueprint("social", __name__)


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


def _public_slug(display_name: str | None, user_id: str) -> str:
    suffix = str(user_id)[-6:] or "signal"
    base = _slugify(display_name or "")
    return f"{base}-{suffix}" if base else f"user-{suffix}"


def _display_name_from_payload(user_id: str, payload: dict | None, existing: dict | None = None) -> str:
    user_profile = (payload or {}).get("userProfile") or {}
    return (
        (existing or {}).get("display_name")
        or user_profile.get("display_name")
        or user_profile.get("name")
        or user_profile.get("username")
        or f"user-{user_id[-6:]}"
    )


def _snapshot_profile(user_id: str) -> dict | None:
    snapshot = get_latest_snapshot(user_id)
    return (snapshot or {}).get("payload")


def _public_profile_from_payload(user_id: str, payload: dict | None, existing: dict | None = None) -> dict:
    payload = payload or {}
    artists = payload.get("topArtists") or []
    genres = payload.get("genres") or []
    audio = payload.get("audioFeatures") or {}
    analytics = payload.get("analyticsMetrics") or {}
    personality = payload.get("personality") or []
    mbti = payload.get("mbti") or {}
    music_identity = payload.get("musicIdentity") or {}
    identity_name = ((music_identity.get("type") or {}).get("name")) or payload.get("sonicPersonalityTitle") or "Music identity"
    representations = payload.get("representations") or {}
    display_name = _display_name_from_payload(user_id, payload, existing)
    return {
        "user_id": user_id,
        "public_slug": (existing or {}).get("public_slug") or _public_slug(display_name, user_id),
        "display_name": display_name,
        "visibility": (existing or {}).get("visibility", "private"),
        "allow_matching": bool((existing or {}).get("allow_matching", False)),
        "summary": (existing or {}).get("summary")
        or f"{identity_name} shaped by {', '.join([item.get('name') if isinstance(item, dict) else str(item) for item in artists[:3]]) or 'emerging favorites'}.",
        "top_artists": [
            {"name": item.get("name"), "genres": item.get("genres", [])[:3]}
            for item in artists[:8]
            if isinstance(item, dict) and item.get("name")
        ],
        "top_genres": [item.get("genre") if isinstance(item, dict) else str(item) for item in genres[:8]],
        "mood_vector": {
            "energy": audio.get("energy", 0),
            "valence": audio.get("valence", 0),
            "danceability": audio.get("danceability", 0),
            "mood": analytics.get("mood", "unknown"),
        },
        "representations": representations,
        "personality": personality[:4],
        "musicIdentity": music_identity,
        "mbti": mbti,
    }


def _engine_profile_from_public(profile: dict, fallback_payload: dict | None = None) -> dict:
    fallback_payload = fallback_payload or {}
    top_artists = profile.get("top_artists") or []
    top_genres = profile.get("top_genres") or []
    top_tracks = fallback_payload.get("topTracks") or []
    return {
        "user_id": profile.get("user_id"),
        "public_slug": profile.get("public_slug"),
        "publicSlug": profile.get("public_slug"),
        "username": profile.get("display_name") or "Unknown",
        "topArtists": top_artists,
        "genres": top_genres,
        "topTracks": top_tracks,
        "audioFeatures": profile.get("mood_vector") or fallback_payload.get("audioFeatures") or {},
        "analyticsMetrics": fallback_payload.get("analyticsMetrics") or {},
        "personality": profile.get("personality") or fallback_payload.get("personality") or [],
        "musicIdentity": profile.get("musicIdentity") or fallback_payload.get("musicIdentity") or {},
        "mbti": profile.get("mbti") or fallback_payload.get("mbti") or {},
        "representations": profile.get("representations") or fallback_payload.get("representations") or {},
        "profileVector": ((profile.get("representations") or {}).get("profileVector")),
    }


def _constellation_payload(left_profile: dict, right_profile: dict, score: dict) -> dict:
    return {
        "compatibility": score.get("overallCompatibility"),
        "sharedArtists": score.get("sharedArtists", []),
        "sharedGenres": score.get("sharedGenres", []),
        "moodAlignment": score.get("emotionalCompatibility"),
        "complementaryTasteTraits": score.get("complementaryTraits", []),
        "graph": soulmate_engine.build_constellation_graph(
            left_profile,
            right_profile,
            user_a_name=left_profile.get("username", "You"),
            user_b_name=right_profile.get("username", "Soulmate"),
        ),
    }


@social_bp.route("/social/public-profile/<user_id>", methods=["GET"])
@require_auth
def get_public_profile(user_id: str):
    if user_id == "me":
        user_id = g.user_id
        profile = get_social_public_profile(user_id)
    else:
        profile = get_social_public_profile(user_id) or get_social_public_profile_by_slug(user_id)
        if profile:
            user_id = profile.get("user_id")
    if not profile:
        payload = _snapshot_profile(user_id)
        if not payload:
            return api_error("Public profile not found", 404, code="PUBLIC_PROFILE_NOT_FOUND")
        profile = upsert_social_public_profile(user_id, _public_profile_from_payload(user_id, payload))
    if not profile.get("allow_matching") and user_id != g.user_id:
        return api_error("User has not opted into public matching", 403, code="SOCIAL_PROFILE_PRIVATE")
    safe_profile = {
        "user_id": profile.get("user_id"),
        "public_slug": profile.get("public_slug"),
        "publicSlug": profile.get("public_slug"),
        "display_name": profile.get("display_name"),
        "summary": profile.get("summary"),
        "top_artists": profile.get("top_artists", []),
        "top_genres": profile.get("top_genres", []),
        "mood_vector": profile.get("mood_vector", {}),
        "allow_matching": bool(profile.get("allow_matching")),
    }
    return api_success(safe_profile)


@social_bp.route("/social/public-profile", methods=["POST"])
@require_auth
def upsert_public_profile():
    existing = get_social_public_profile(g.user_id) or {}
    snapshot_payload = _snapshot_profile(g.user_id)
    if not snapshot_payload and not request.get_json(silent=True):
        return api_error("Listening profile required before publishing taste profile", 400, code="SOCIAL_PROFILE_SIGNAL_REQUIRED")
    incoming = request.get_json(silent=True) or {}
    payload = _public_profile_from_payload(g.user_id, snapshot_payload, existing=existing)
    payload.update(
        {
            "display_name": incoming.get("display_name") or payload.get("display_name"),
            "public_slug": existing.get("public_slug") or payload.get("public_slug"),
            "visibility": incoming.get("visibility", existing.get("visibility", "private")),
            "allow_matching": bool(incoming.get("allow_matching", existing.get("allow_matching", False))),
            "summary": incoming.get("summary") or payload.get("summary"),
        }
    )
    doc = upsert_social_public_profile(g.user_id, payload)
    return api_success({"profile": doc})


@social_bp.route("/social/soulmate/search", methods=["POST"])
@require_auth
@rate_limit(max_requests=20, window_seconds=60)
def search_soulmates():
    data = request.get_json(silent=True) or {}
    limit = min(max(int(data.get("limit", 8)), 1), 20)
    my_snapshot = _snapshot_profile(g.user_id)
    if not my_snapshot:
        return api_error("Listening profile not ready", 404, code="SOCIAL_PROFILE_SIGNAL_REQUIRED")
    my_public = get_social_public_profile(g.user_id) or upsert_social_public_profile(g.user_id, _public_profile_from_payload(g.user_id, my_snapshot))
    my_profile = _engine_profile_from_public(my_public, my_snapshot)

    matches = []
    for candidate in list_social_public_profiles(limit=100):
        if candidate.get("user_id") == g.user_id or not candidate.get("allow_matching"):
            continue
        candidate_snapshot = _snapshot_profile(candidate.get("user_id"))
        candidate_profile = _engine_profile_from_public(candidate, candidate_snapshot)
        score = soulmate_engine.compute_score(my_profile, candidate_profile)
        matches.append(
            {
                "userId": candidate.get("user_id"),
                "publicSlug": candidate.get("public_slug"),
                "displayName": candidate.get("display_name"),
                "summary": candidate.get("summary"),
                "compatibilityScore": score.get("overallCompatibility"),
                "sharedArtists": score.get("sharedArtists", [])[:5],
                "sharedGenres": score.get("sharedGenres", [])[:5],
                "moodAlignment": score.get("emotionalCompatibility"),
                "complementaryTasteTraits": score.get("complementaryTraits", [])[:4],
                "constellation": _constellation_payload(my_profile, candidate_profile, score),
            }
        )
    matches.sort(key=lambda item: item.get("compatibilityScore", 0), reverse=True)
    return api_success({"matches": matches[:limit]})


@social_bp.route("/social/soulmate/compare", methods=["POST"])
@require_auth
def compare_social_soulmate():
    data = request.get_json(silent=True) or {}
    target_user_id = data.get("target_user_id")
    if not target_user_id:
        return api_error("target_user_id required", 400, code="SOCIAL_TARGET_REQUIRED")
    my_snapshot = _snapshot_profile(g.user_id)
    target_public = get_social_public_profile(target_user_id) or get_social_public_profile_by_slug(target_user_id)
    if target_public:
        target_user_id = target_public.get("user_id")
    target_snapshot = _snapshot_profile(target_user_id)
    my_public = get_social_public_profile(g.user_id) or upsert_social_public_profile(g.user_id, _public_profile_from_payload(g.user_id, my_snapshot))
    if not target_public or not target_public.get("allow_matching"):
        return api_error("Target user has not opted into social matching", 403, code="SOCIAL_PROFILE_PRIVATE")
    my_profile = _engine_profile_from_public(my_public, my_snapshot)
    target_profile = _engine_profile_from_public(target_public, target_snapshot)
    score = soulmate_engine.compute_score(my_profile, target_profile)
    return api_success(
        {
            "comparison": {
                "compatibilityScore": score.get("overallCompatibility"),
                "sharedArtists": score.get("sharedArtists", []),
                "sharedGenres": score.get("sharedGenres", []),
                "moodAlignment": score.get("emotionalCompatibility"),
                "complementaryTasteTraits": score.get("complementaryTraits", []),
                "constellation": _constellation_payload(my_profile, target_profile, score),
                "publicSlug": target_public.get("public_slug"),
                "details": score,
            }
        }
    )


@social_bp.route("/social/soulmate/request", methods=["POST"])
@require_auth
def create_request():
    data = request.get_json(silent=True) or {}
    target_user_id = data.get("target_user_id")
    if not target_user_id:
        return api_error("target_user_id required", 400, code="SOCIAL_TARGET_REQUIRED")
    target_profile = get_social_public_profile(target_user_id) or get_social_public_profile_by_slug(target_user_id)
    if target_profile:
        target_user_id = target_profile.get("user_id")
    if not target_profile or not target_profile.get("allow_matching"):
        return api_error("Target user has not opted into social matching", 403, code="SOCIAL_PROFILE_PRIVATE")
    doc = create_soulmate_request(g.user_id, target_user_id, {"note": data.get("note")})
    return api_success({"request": doc}, status=201)


@social_bp.route("/social/soulmate/accept", methods=["POST"])
@require_auth
def accept_request():
    data = request.get_json(silent=True) or {}
    request_id = data.get("request_id")
    if not request_id:
        return api_error("request_id required", 400, code="SOCIAL_REQUEST_REQUIRED")
    request_doc = accept_soulmate_request(request_id)
    if not request_doc:
        return api_error("Request not found", 404, code="SOCIAL_REQUEST_NOT_FOUND")
    if request_doc.get("target_user_id") != g.user_id:
        return api_error("Only the target user can accept this request", 403, code="SOCIAL_REQUEST_FORBIDDEN")

    left_snapshot = _snapshot_profile(request_doc["source_user_id"])
    right_snapshot = _snapshot_profile(request_doc["target_user_id"])
    left_public = get_social_public_profile(request_doc["source_user_id"]) or upsert_social_public_profile(request_doc["source_user_id"], _public_profile_from_payload(request_doc["source_user_id"], left_snapshot))
    right_public = get_social_public_profile(request_doc["target_user_id"]) or upsert_social_public_profile(request_doc["target_user_id"], _public_profile_from_payload(request_doc["target_user_id"], right_snapshot))
    left_profile = _engine_profile_from_public(left_public, left_snapshot)
    right_profile = _engine_profile_from_public(right_public, right_snapshot)
    score = soulmate_engine.compute_score(left_profile, right_profile)
    match = upsert_soulmate_match(
        request_doc["source_user_id"],
        request_doc["target_user_id"],
        {
            "compatibilityScore": score.get("overallCompatibility"),
            "sharedArtists": score.get("sharedArtists", []),
            "sharedGenres": score.get("sharedGenres", []),
            "moodAlignment": score.get("emotionalCompatibility"),
            "constellation": _constellation_payload(left_profile, right_profile, score),
        },
    )
    return api_success({"request": request_doc, "match": match, "pending": list_soulmate_requests(g.user_id)})


@social_bp.route("/social/soulmate/requests", methods=["GET"])
@require_auth
def get_requests():
    status = request.args.get("status")
    return api_success({"requests": list_soulmate_requests(g.user_id, status=status)})

from __future__ import annotations

from flask import Blueprint, request

from middleware.auth import require_auth
from utils.api import api_success

share_bp = Blueprint("share", __name__)


@share_bp.route("/share/identity-card", methods=["POST"])
@require_auth
def share_identity_card():
    data = request.get_json(silent=True) or {}
    archetype = data.get("archetype") or "Music self"
    mbti = data.get("mbti") or "Soft-signal"
    genres = ", ".join((data.get("topGenres") or [])[:3])
    share_text = f"My Melody Map identity is {archetype} ({mbti}) shaped by {genres or 'an evolving set of genres'}."
    return api_success(
        {
            "shareText": share_text,
            "meta": {
                "archetype": archetype,
                "mbti": mbti,
                "topGenres": data.get("topGenres") or [],
            },
        }
    )

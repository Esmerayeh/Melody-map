from __future__ import annotations

from flask import Blueprint, g, request

from middleware.auth import require_auth
from services.feature_store import get_latest_snapshot
from services.identity_drift import RANGE_MAP, compute_drift, list_stored_snapshots, store_identity_snapshot
from services.listening_memory import build_listening_memory_model
from utils.api import api_error, api_success

identity_bp = Blueprint("identity", __name__)


@identity_bp.route("/identity/drift", methods=["GET"])
@require_auth
def identity_drift():
    range_key = request.args.get("range", "all")
    if range_key not in RANGE_MAP:
        return api_error("range must be one of monthly|quarterly|half_year|all", 400, code="IDENTITY_RANGE_INVALID")
    snapshot_doc = get_latest_snapshot(g.user_id)
    payload = (snapshot_doc or {}).get("payload")
    if not payload:
        return api_error("Listening profile not ready", 404, code="IDENTITY_PROFILE_NOT_FOUND")

    # Always refresh the requested range and keep the already-stored history for timeline math.
    store_identity_snapshot(g.user_id, range_key, payload)
    stored = list_stored_snapshots(g.user_id)
    if range_key != "all":
        selected = next((item for item in stored if item.get("range") == range_key), None)
        return api_success(
            {
                "selectedRange": range_key,
                "snapshot": selected,
                "timeline": stored,
                "drift": compute_drift(stored),
                "listeningMemory": build_listening_memory_model(g.user_id, payload),
            }
        )
    return api_success(
        {
            "selectedRange": "all",
            "timeline": stored,
            "drift": compute_drift(stored),
            "listeningMemory": build_listening_memory_model(g.user_id, payload),
        }
    )


@identity_bp.route("/identity/memory", methods=["GET"])
@require_auth
def identity_memory():
    snapshot_doc = get_latest_snapshot(g.user_id)
    payload = (snapshot_doc or {}).get("payload")
    if not payload:
        return api_error("Listening profile not ready", 404, code="IDENTITY_PROFILE_NOT_FOUND")
    return api_success({"memory": build_listening_memory_model(g.user_id, payload)})

from flask import Blueprint, jsonify, request

from utils.api import api_error, api_success_legacy

auralith_bp = Blueprint("auralith", __name__)

_engine = None
_engine_error = None

def get_engine():
    global _engine, _engine_error
    if _engine is None:
        try:
            from services.auralith_engine import AuralithEngine
            _engine = AuralithEngine()
            _engine_error = None
        except Exception as exc:
            _engine_error = str(exc)
            raise
    return _engine


def _require_engine():
    try:
        return get_engine(), None
    except Exception:
        return None, api_error("Auralith engine unavailable", 503, code="AURALITH_ENGINE_UNAVAILABLE", details=_engine_error)


@auralith_bp.route("/auralith/generate-playlist", methods=["POST"])
def generate_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    payload = engine.generate_playlist(prompt, data.get("profile"), data.get("limit", 8))
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


@auralith_bp.route("/auralith/analyze-taste", methods=["POST"])
def analyze_taste():
    data = request.get_json() or {}
    seeds = data.get("seeds") or []
    if not seeds:
        return api_error("seeds required", 400, code="SEEDS_REQUIRED")
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    payload = engine.analyze_taste(seeds, data.get("profile"))
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


@auralith_bp.route("/auralith/explain-song", methods=["POST"])
def explain_song():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    payload = engine.explain_song(prompt, data.get("profile"))
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


@auralith_bp.route("/auralith/critique-playlist", methods=["POST"])
def critique_playlist():
    data = request.get_json() or {}
    songs = data.get("songs") or []
    if not songs:
        return api_error("songs required", 400, code="SONGS_REQUIRED")
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    payload = engine.critique_playlist(songs, data.get("profile"))
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


@auralith_bp.route("/auralith/concept-playlist", methods=["POST"])
def concept_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    payload = engine.concept_playlist(prompt, data.get("profile"), data.get("limit", 8))
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)

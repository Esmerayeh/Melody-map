from flask import Blueprint, jsonify, request

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
        return None, (jsonify({"error": "Auralith engine unavailable", "details": _engine_error}), 503)


@auralith_bp.route("/auralith/generate-playlist", methods=["POST"])
def generate_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    return jsonify(engine.generate_playlist(prompt, data.get("profile"), data.get("limit", 8))), 200


@auralith_bp.route("/auralith/analyze-taste", methods=["POST"])
def analyze_taste():
    data = request.get_json() or {}
    seeds = data.get("seeds") or []
    if not seeds:
        return jsonify({"error": "seeds required"}), 400
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    return jsonify(engine.analyze_taste(seeds, data.get("profile"))), 200


@auralith_bp.route("/auralith/explain-song", methods=["POST"])
def explain_song():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    return jsonify(engine.explain_song(prompt, data.get("profile"))), 200


@auralith_bp.route("/auralith/critique-playlist", methods=["POST"])
def critique_playlist():
    data = request.get_json() or {}
    songs = data.get("songs") or []
    if not songs:
        return jsonify({"error": "songs required"}), 400
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    return jsonify(engine.critique_playlist(songs, data.get("profile"))), 200


@auralith_bp.route("/auralith/concept-playlist", methods=["POST"])
def concept_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    engine, error_response = _require_engine()
    if error_response:
        return error_response
    return jsonify(engine.concept_playlist(prompt, data.get("profile"), data.get("limit", 8))), 200

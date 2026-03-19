from flask import Blueprint, jsonify, request

from services.auralith_engine import AuralithEngine

auralith_bp = Blueprint("auralith", __name__)
engine = AuralithEngine()


@auralith_bp.route("/auralith/generate-playlist", methods=["POST"])
def generate_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    return jsonify(engine.generate_playlist(prompt, data.get("profile"), data.get("limit", 8))), 200


@auralith_bp.route("/auralith/analyze-taste", methods=["POST"])
def analyze_taste():
    data = request.get_json() or {}
    seeds = data.get("seeds") or []
    if not seeds:
        return jsonify({"error": "seeds required"}), 400
    return jsonify(engine.analyze_taste(seeds, data.get("profile"))), 200


@auralith_bp.route("/auralith/explain-song", methods=["POST"])
def explain_song():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    return jsonify(engine.explain_song(prompt, data.get("profile"))), 200


@auralith_bp.route("/auralith/critique-playlist", methods=["POST"])
def critique_playlist():
    data = request.get_json() or {}
    songs = data.get("songs") or []
    if not songs:
        return jsonify({"error": "songs required"}), 400
    return jsonify(engine.critique_playlist(songs, data.get("profile"))), 200


@auralith_bp.route("/auralith/concept-playlist", methods=["POST"])
def concept_playlist():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    return jsonify(engine.concept_playlist(prompt, data.get("profile"), data.get("limit", 8))), 200

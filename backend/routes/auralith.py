from flask import Blueprint, g, request

from middleware.auth import require_auth
from services.auralith_explainer import build_explainability_payload
from services.auralith_memory import build_memory_chunks, retrieve_memory_chunks
from services.auralith_planner import plan_auralith_steps
from services.feature_store import get_auralith_thread, list_auralith_threads, save_auralith_message
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


@auralith_bp.route("/auralith/agent-turn", methods=["POST"])
@require_auth
def agent_turn():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    thread_id = (data.get("thread_id") or "default").strip() or "default"
    profile = data.get("profile")
    mode = (data.get("mode") or "playlist").strip()
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")

    engine, error_response = _require_engine()
    if error_response:
        return error_response

    save_auralith_message(g.user_id, thread_id, "user", {"prompt": prompt, "mode": mode})
    history = get_auralith_thread(g.user_id, thread_id) or {"messages": []}
    message_count = len(history.get("messages") or [])
    retrieval_context = engine._retrieve_grounding(prompt, profile)
    steps = plan_auralith_steps(mode, prompt, retrieval_context)

    if mode == "analyze":
        seeds = [item.strip() for item in prompt.split("\n") if item.strip()]
        payload = engine.analyze_taste(seeds, profile)
        tool_used = "analyze_taste"
    elif mode == "explain":
        payload = engine.explain_song(prompt, profile)
        tool_used = "explain_song"
    elif mode == "critique":
        songs = [item.strip() for item in prompt.split("\n") if item.strip()]
        payload = engine.critique_playlist(songs, profile)
        tool_used = "critique_playlist"
    elif mode == "concept":
        payload = engine.concept_playlist(prompt, profile, data.get("limit", 8))
        tool_used = "concept_playlist"
    else:
        payload = engine.generate_playlist(prompt, profile, data.get("limit", 8))
        tool_used = "generate_playlist"

    steps.append({"id": "tool_call", "label": f"Run {tool_used}", "status": "completed"})
    payload = build_explainability_payload({
        **payload,
        "thread_id": thread_id,
        "agent_trace": {
            "steps": steps,
            "toolUsed": tool_used,
            "mode": mode,
            "historyDepth": message_count,
        },
    }, retrieval_context, "auralith-rag-v1")
    save_auralith_message(g.user_id, thread_id, "assistant", payload)
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


@auralith_bp.route("/auralith/threads", methods=["GET"])
@require_auth
def threads():
    limit = min(max(int(request.args.get("limit", 8)), 1), 20)
    return api_success_legacy({"threads": list_auralith_threads(g.user_id, limit=limit)}, status=200)


@auralith_bp.route("/auralith/rag", methods=["POST"])
@require_auth
def rag_answer():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    profile = data.get("profile")
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")

    build_memory_chunks(g.user_id, profile=profile)
    retrieval = retrieve_memory_chunks(g.user_id, prompt, limit=min(max(int(data.get("limit", 6)), 1), 12), profile=profile)
    chunks = retrieval.get("chunks", [])
    source_types = retrieval.get("source_types", [])
    if chunks:
        answer = (
            f"Auralith hears a pattern here: {chunks[0].get('content')} "
            f"Across {', '.join(source_types) or 'your listening memory'}, the same emotional gravity keeps resurfacing."
        )
        explanation = retrieval.get("explanation")
    else:
        answer = "Auralith could not find enough indexed listening memory yet, so it is leaning on your current profile and recent signal only."
        explanation = "Vector memory retrieval was unavailable, so the answer fell back to profile-level context."
    payload = {
        "answer": answer,
        "retrieved_memories": chunks,
        "confidence": {"score": retrieval.get("confidence", 0.22), "label": "high" if retrieval.get("confidence", 0) >= 0.72 else "medium" if retrieval.get("confidence", 0) >= 0.48 else "low"},
        "source_types": source_types,
        "explanation": explanation,
        "fallbackUsed": not bool(chunks),
        "modelVersion": "auralith-rag-v2",
    }
    return api_success_legacy(payload, status=200)

from flask import Blueprint, g, request

from config import Config
from middleware.auth import require_auth
from services.auralith_engine import _call_llm
from services.auralith_explainer import build_explainability_payload
from services.auralith_memory import build_memory_chunks, retrieve_memory_chunks
from services.auralith_planner import plan_auralith_steps
from services.feature_store import get_auralith_thread, list_auralith_threads, save_auralith_message
from utils.api import api_error, api_success_legacy
from utils.logger import logger

# ── System prompt ──────────────────────────────────────────────────────────
_LLM_SYSTEM = """You are Auralith — a calm, intelligent music oracle embedded inside Melody Map.
You help users understand the deeper meaning, patterns, and emotional signature of their listening history.

Guidelines:
- Be specific, not generic. Reference the profile data you are given.
- Keep responses short (2-4 sentences). Longer answers belong in a report, not a conversation.
- Never claim certainty you do not have. Use phrases like "the pattern suggests" or "this listening signal leans toward".
- Do not be sycophantic. Do not start with "Great question!".
- You are grounded in the retrieved songs and profile below. Do not invent artists or tracks.
- If the profile data is thin, say so honestly rather than fabricating insight."""


def _build_grounded_user_msg(
    prompt: str,
    profile: dict | None,
    retrieved_songs: list[dict],
    entity: dict | None = None,
    coords: dict | None = None,
    nearby_artists: list[str] | None = None,
    memory_chunks: list[dict] | None = None,
) -> tuple[str, list[str]]:
    """
    Construct the richly grounded user message and a list of evidence labels.
    Returns (user_message_str, evidence_used_list).
    """
    p = profile or {}
    evidence_used: list[str] = []

    # ── Profile fields ───────────────────────────────────────────────────────
    def _label(item, *keys):
        if isinstance(item, str):
            return item.strip()
        for k in keys:
            v = (item or {}).get(k)
            if v:
                return str(v).strip()
        return ""

    genres  = [_label(g, "genre", "name") for g in (p.get("genres") or [])[:5] if g]
    artists = [_label(a, "name", "artist") for a in (p.get("topArtists") or p.get("favoriteArtists") or [])[:5] if a]
    tracks  = [_label(t, "name", "title") for t in (p.get("topTracks") or [])[:4] if t]
    mbti    = (_label(p.get("mbti") or {}, "type") or "") if isinstance(p.get("mbti"), dict) else str(p.get("mbti") or "")
    mood    = (p.get("analyticsMetrics") or {}).get("mood") or ""
    pers    = [_label(item, "archetype", "label") for item in (p.get("personality") or [])[:2] if item]
    audio   = p.get("audioFeatures") or {}

    if genres:
        evidence_used.append("genres")
    if artists:
        evidence_used.append("top_artists")
    if tracks:
        evidence_used.append("top_tracks")

    # ── Retrieved song corpus ────────────────────────────────────────────────
    songs_lines: list[str] = []
    for s in retrieved_songs[:6]:
        title  = s.get("title") or s.get("name") or ""
        artist = s.get("artist") or s.get("source_type") or ""
        mood_s = s.get("mood") or ""
        if title or artist:
            songs_lines.append(f"  - {title} by {artist}" + (f" ({mood_s})" if mood_s else ""))
    if songs_lines:
        evidence_used.append("retrieved_songs")

    # ── Semantic entity (selected star/comet/artist node) ───────────────────
    entity_block = ""
    if entity:
        e_name   = entity.get("name") or entity.get("artistName") or entity.get("id") or ""
        e_genre  = entity.get("genre") or ""
        e_energy = entity.get("energy")
        e_val    = entity.get("valence")
        parts = [f"Selected entity: {e_name}"]
        if e_genre:
            parts.append(f"genre={e_genre}")
        if e_energy is not None:
            parts.append(f"energy={round(float(e_energy), 2)}")
        if e_val is not None:
            parts.append(f"valence={round(float(e_val), 2)}")
        entity_block = ", ".join(parts)
        evidence_used.append("selected_entity")

    # ── Semantic coordinates ─────────────────────────────────────────────────
    coords_block = ""
    if coords:
        cx = coords.get("x") or coords.get("valence")
        cy = coords.get("y") or coords.get("energy")
        cz = coords.get("z") or coords.get("texture")
        if any(v is not None for v in [cx, cy, cz]):
            coords_block = (
                f"Galaxy position — valence: {round(float(cx), 2) if cx is not None else '?'}, "
                f"energy: {round(float(cy), 2) if cy is not None else '?'}, "
                f"texture: {round(float(cz), 2) if cz is not None else '?'}"
            )
            evidence_used.append("semantic_coordinates")

    # ── Nearby artists in galaxy ─────────────────────────────────────────────
    nearby_block = ""
    if nearby_artists:
        nearby_block = "Nearby artists in galaxy: " + ", ".join(nearby_artists[:5])
        evidence_used.append("nearby_artists")

    # ── Memory chunks (Auralith long-term memory) ────────────────────────────
    memory_block = ""
    if memory_chunks:
        lines = [f"  - {c.get('content') or c.get('title') or ''}" for c in memory_chunks[:4] if c]
        if lines:
            memory_block = "Memory chunks:\n" + "\n".join(lines)
            evidence_used.append("memory_chunks")

    # ── Audio features ───────────────────────────────────────────────────────
    audio_block = ""
    if audio:
        fields = {k: round(float(v), 2) for k, v in audio.items() if v is not None and isinstance(v, (int, float))}
        if fields:
            audio_block = "Audio features: " + ", ".join(f"{k}={v}" for k, v in list(fields.items())[:6])
            evidence_used.append("audio_features")

    # ── Assemble message ─────────────────────────────────────────────────────
    parts_out = [f"User question: {prompt}", ""]

    if entity_block:
        parts_out.append(entity_block)
    if coords_block:
        parts_out.append(coords_block)
    if nearby_block:
        parts_out.append(nearby_block)

    parts_out.append("Profile context:")
    parts_out.append(f"  Genres:    {', '.join(genres) or 'unknown'}")
    parts_out.append(f"  Artists:   {', '.join(artists) or 'unknown'}")
    if tracks:
        parts_out.append(f"  Tracks:    {', '.join(tracks)}")
    parts_out.append(f"  Mood:      {mood or 'unknown'}")
    parts_out.append(f"  Archetype: {', '.join(p for p in pers if p) or 'unknown'}")
    if mbti:
        parts_out.append(f"  MBTI hint: {mbti}")
    if audio_block:
        parts_out.append(f"  {audio_block}")

    if songs_lines:
        parts_out.append("")
        parts_out.append("Retrieved songs grounding this response:")
        parts_out.extend(songs_lines)

    if memory_block:
        parts_out.append("")
        parts_out.append(memory_block)

    parts_out.append("")
    parts_out.append("Answer in 2-4 sentences, grounded in the data above.")

    return "\n".join(parts_out), evidence_used


def _llm_oracle_response(
    prompt: str,
    profile: dict | None,
    retrieved_songs: list[dict],
    entity: dict | None = None,
    coords: dict | None = None,
    nearby_artists: list[str] | None = None,
    memory_chunks: list[dict] | None = None,
) -> dict:
    """
    Attempt an LLM-grounded response.

    Returns a dict:
        {
            "text":            str | None,
            "provider":        str,          # "groq" / "anthropic" / "openai_compatible" / "none"
            "llm_model":       str | None,
            "model_version":   str,          # "auralith-llm-grounded" or "auralith-retrieval-v1"
            "confidence_level": str,         # "high" | "medium" | "low"
            "evidence_used":   list[str],
            "fallback_reason": str | None,
        }
    """
    if not Config.auralith_llm_endpoint or not Config.auralith_llm_api_key:
        return {
            "text": None,
            "provider": "none",
            "llm_model": None,
            "model_version": "auralith-retrieval-v1",
            "confidence_level": "low",
            "evidence_used": [],
            "fallback_reason": "llm_not_configured",
        }

    user_msg, evidence_used = _build_grounded_user_msg(
        prompt, profile, retrieved_songs,
        entity=entity,
        coords=coords,
        nearby_artists=nearby_artists,
        memory_chunks=memory_chunks,
    )

    result = _call_llm(_LLM_SYSTEM, user_msg)

    text    = result.get("text")
    is_grounded = bool(text and text.strip())

    # confidence: high if we have rich evidence, medium if partial, low if thin
    evidence_count = len(evidence_used)
    if is_grounded and evidence_count >= 4:
        confidence_level = "high"
    elif is_grounded and evidence_count >= 2:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    return {
        "text":            text,
        "provider":        result.get("provider", "none"),
        "llm_model":       result.get("llm_model"),
        "model_version":   "auralith-llm-grounded" if is_grounded else "auralith-retrieval-v1",
        "confidence_level": confidence_level,
        "evidence_used":   evidence_used,
        "fallback_reason": result.get("fallback_reason"),
    }

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

    # ── Try LLM-grounded enrichment when endpoint is configured ──────────────
    retrieved_songs = [
        *((retrieval_context.get("nearest_tracks") or [])[:4]),
        *((retrieval_context.get("memories") or [])[:4]),
    ]
    entity         = data.get("entity")          # selected star/comet dict from frontend
    coords         = data.get("coords")          # {x, y, z} semantic coordinates
    nearby_artists = data.get("nearbyArtists")   # list[str]
    memory_chunks_ctx = data.get("memoryChunks") # list[dict] from frontend memory belt

    llm_result = _llm_oracle_response(
        prompt, profile, retrieved_songs,
        entity=entity,
        coords=coords,
        nearby_artists=nearby_artists,
        memory_chunks=memory_chunks_ctx,
    )
    llm_text      = llm_result["text"]
    model_version = llm_result["model_version"]

    if llm_text:
        payload["vibe_summary"]  = llm_text
        payload["llm_answer"]    = llm_text
        payload["llm_model"]     = llm_result["llm_model"]
        steps.append({"id": "llm_grounding", "label": "LLM grounding (Groq)", "status": "completed"})
    elif llm_result.get("fallback_reason"):
        steps.append({
            "id":     "llm_grounding",
            "label":  f"LLM fallback ({llm_result['fallback_reason']})",
            "status": "fallback",
        })

    payload = build_explainability_payload({
        **payload,
        "thread_id":    thread_id,
        "agent_trace":  {
            "steps":        steps,
            "toolUsed":     tool_used,
            "mode":         mode,
            "historyDepth": message_count,
        },
    }, retrieval_context, model_version)

    payload["modelVersion"]    = model_version
    payload["provider"]        = llm_result["provider"]
    payload["llm_model"]       = llm_result["llm_model"]
    payload["confidence_level"] = llm_result["confidence_level"]
    payload["evidence_used"]   = llm_result["evidence_used"]
    if llm_result.get("fallback_reason"):
        payload["fallback_reason"] = llm_result["fallback_reason"]

    save_auralith_message(g.user_id, thread_id, "assistant", payload)
    return api_success_legacy(payload, status=200, warnings=payload.get("warnings") if isinstance(payload, dict) else None)


def _safe_items(items, limit=5):
    return [item for item in (items or []) if item][:limit]


def _score_line(label: str, value) -> str | None:
    if value is None:
        return None
    return f"{label}: {round(value)}%"


def _soulmate_answer(prompt: str, comparison: dict) -> dict:
    if not comparison:
        return {
            "answer": "I cannot read this match honestly without a compatibility result. Generate or open a soulmate comparison first, then ask again from that grounded overlap.",
            "confidence": {"score": 0.18, "label": "limited"},
            "evidence": [],
            "fallbackUsed": True,
            "modelVersion": "auralith-soulmate-v1",
        }

    prompt_l = prompt.lower()
    duo = comparison.get("duoIdentity") or {}
    atmosphere = comparison.get("sharedAtmosphereIdentity") or {}
    songs = comparison.get("songsBothMayLove") or comparison.get("bridgeTracks") or []
    shared_artists = _safe_items(comparison.get("sharedArtists") or comparison.get("shared_artists"), 6)
    shared_genres = _safe_items(comparison.get("sharedGenres") or comparison.get("shared_genres"), 6)
    evidence = _safe_items(comparison.get("evidenceReceipts") or comparison.get("whyThisWorksEvidence"), 6)
    scores = [
        _score_line("overall compatibility", comparison.get("overallCompatibility") or comparison.get("match_score")),
        _score_line("emotional resonance", comparison.get("emotionalCompatibility")),
        _score_line("discovery edge", comparison.get("discoveryCompatibility")),
        _score_line("beautiful tension", comparison.get("tensionScore")),
    ]
    scores = [item for item in scores if item]

    if "song" in prompt_l or "playlist" in prompt_l or "send" in prompt_l:
        song_lines = [
            f"{track.get('title')} by {track.get('artist') or 'unknown artist'} - {track.get('whyItFitsBoth') or track.get('reason') or 'it bridges the two profiles'}"
            for track in songs[:5]
            if track.get("title")
        ]
        answer = "I would start with these bridge songs: " + ("; ".join(song_lines) if song_lines else "the profiles do not expose enough shared or bridge tracks yet.")
    elif "differ" in prompt_l or "different" in prompt_l or "contrast" in prompt_l:
        answer = comparison.get("whereItGetsInteresting") or duo.get("whereYouDiverge") or "The useful difference is still subtle; the current data shows more shared atmosphere than sharp contrast."
    elif "atmosphere" in prompt_l or "feel" in prompt_l:
        answer = f"Your shared atmosphere reads as {atmosphere.get('name', 'an emerging atmosphere')}. {atmosphere.get('explanation', comparison.get('sharedAtmosphereNarrative', 'It comes from shared genres, artists, and audio-feature alignment.'))}"
    elif "identity" in prompt_l:
        answer = f"Your duo identity is {duo.get('pairName', comparison.get('relationshipArchetype', 'a shared orbit'))}. {duo.get('oneLine', comparison.get('archetypeSummary', 'The reading is still forming from available overlap.'))}"
    else:
        answer = comparison.get("whyThisWorks") or comparison.get("compatibilityNarrative") or "This match works where the two Spotify profiles show measurable overlap, emotional similarity, and bridgeable contrast."

    if shared_artists:
        answer += f" The clearest artist anchors are {', '.join(shared_artists[:4])}."
    if shared_genres:
        answer += f" The genre field leans through {', '.join(shared_genres[:4])}."
    if scores:
        answer += f" Score receipts: {', '.join(scores)}."

    return {
        "answer": answer,
        "pairIdentity": duo,
        "sharedAtmosphere": atmosphere,
        "songs": songs[:6],
        "evidence": evidence,
        "confidence": comparison.get("confidence") or {"score": 0.42, "label": "medium"},
        "fallbackUsed": not bool(evidence or shared_artists or shared_genres),
        "modelVersion": "auralith-soulmate-v1",
    }


@auralith_bp.route("/auralith/soulmate", methods=["POST"])
@require_auth
def soulmate_answer():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return api_error("prompt required", 400, code="PROMPT_REQUIRED")
    payload = _soulmate_answer(prompt, data.get("comparison") or {})
    return api_success_legacy(payload, status=200, warnings=["soulmate_context_missing"] if payload.get("fallbackUsed") else None)


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

    # Memory indexing + retrieval are best-effort. A failure here must degrade to
    # a graceful "not enough signal" answer, never a 500.
    try:
        build_memory_chunks(g.user_id, profile=profile)
        retrieval = retrieve_memory_chunks(g.user_id, prompt, limit=min(max(int(data.get("limit", 6)), 1), 12), profile=profile)
    except Exception as exc:
        logger.error({"event": "auralith_rag_retrieval_failed", "error": str(exc)}, exc_info=True)
        retrieval = {"chunks": [], "source_types": [], "confidence": 0.0}
    chunks = retrieval.get("chunks", [])
    source_types = retrieval.get("source_types", [])

    # ── LLM grounded oracle (when configured) ─────────────────────────────
    retrieved_songs = [{"title": c.get("title", ""), "artist": c.get("source_type", ""), "mood": ""} for c in chunks[:6]]
    entity         = data.get("entity")
    coords         = data.get("coords")
    nearby_artists = data.get("nearbyArtists")

    llm_result    = _llm_oracle_response(
        prompt, profile, retrieved_songs,
        entity=entity,
        coords=coords,
        nearby_artists=nearby_artists,
        memory_chunks=chunks,  # the rag chunks already are the memory context
    )
    llm_text      = llm_result["text"]
    model_version = llm_result["model_version"]

    if llm_text:
        answer      = llm_text
        explanation = "Response grounded in retrieved memories and LLM inference (Groq)."
    elif chunks:
        primary      = chunks[0].get("content")
        supporting   = [chunk.get("title") for chunk in chunks[1:4] if chunk.get("title")]
        support_text = f" Supporting memories: {', '.join(supporting)}." if supporting else ""
        answer = (
            f"Here is the grounded read: {primary} "
            f"This comes from {', '.join(source_types) or 'your indexed listening memory'}, not a generic script."
            f"{support_text}"
        )
        explanation = retrieval.get("explanation")
    else:
        answer = (
            "I do not have enough indexed listening memory to make that claim honestly yet. "
            "Sync more history and Auralith will answer from stored artists, tracks, sessions, "
            "and identity signals."
        )
        explanation = "Memory retrieval unavailable; no emotional interpretation was fabricated."

    confidence_score = retrieval.get("confidence", 0.22)
    payload = {
        "answer":            answer,
        "retrieved_memories": chunks,
        "confidence": {
            "score": confidence_score,
            "label": "high"   if confidence_score >= 0.72
                     else "medium" if confidence_score >= 0.48
                     else "low",
        },
        "source_types":      source_types,
        "explanation":       explanation,
        "fallbackUsed":      not bool(chunks) and not llm_text,
        "modelVersion":      model_version,
        "provider":          llm_result["provider"],
        "llm_model":         llm_result["llm_model"],
        "confidence_level":  llm_result["confidence_level"],
        "evidence_used":     llm_result["evidence_used"],
    }
    if llm_result.get("fallback_reason"):
        payload["fallback_reason"] = llm_result["fallback_reason"]
    return api_success_legacy(payload, status=200)

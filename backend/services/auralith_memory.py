from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime

from ml.representation_learning import EMBEDDING_VERSION, cosine_similarity, embed_tokens
from services.feature_store import (
    get_latest_snapshot,
    get_recent_events,
    list_auralith_chunks,
    register_embedding,
    upsert_auralith_chunk,
)
from services.listening_memory import build_listening_memory_model


def _tokens(value: str | None) -> list[str]:
    return [token.lower() for token in str(value or "").replace("/", " ").replace(",", " ").replace("-", " ").split() if token]


def _track_key(track: dict) -> str:
    title = track.get("title") or track.get("name") or ""
    artist = track.get("artist") or ""
    return track.get("id") or track.get("spotify_id") or f"{title}::{artist}"


def _chunk_document(user_id: str, source_type: str, title: str, content: str, metadata: dict | None = None) -> dict:
    vector = embed_tokens(_tokens(f"{title} {content}"), salt=f"auralith:{source_type}")
    chunk = upsert_auralith_chunk(
        user_id,
        {
            "source_type": source_type,
            "title": title,
            "content": content,
            "metadata": metadata or {},
            "embedding_version": EMBEDDING_VERSION,
        },
    )
    register_embedding("auralith_chunk", chunk["chunk_id"], EMBEDDING_VERSION, vector, {"user_id": user_id, "source_type": source_type})
    chunk["vector"] = vector
    return chunk


def build_memory_chunks(user_id: str, profile: dict | None = None) -> list[dict]:
    snapshot = get_latest_snapshot(user_id)
    payload = profile or (snapshot or {}).get("payload") or {}
    chunks: list[dict] = []

    top_tracks = payload.get("topTracks") or []
    for index, track in enumerate(top_tracks[:10]):
        title = track.get("title") or track.get("name") or f"Top track {index + 1}"
        artist = track.get("artist") or ""
        reason = f"Top track memory around {title} by {artist}."
        chunks.append(_chunk_document(user_id, "top_track", title, reason, {"rank": index + 1, "track_key": _track_key(track)}))

    top_artists = payload.get("topArtists") or []
    for index, artist in enumerate(top_artists[:10]):
        name = artist.get("name") if isinstance(artist, dict) else str(artist)
        genres = ", ".join((artist.get("genres") or [])[:3]) if isinstance(artist, dict) else ""
        content = f"Artist anchor {name}. Genres: {genres or 'unclassified'}."
        chunks.append(_chunk_document(user_id, "top_artist", name, content, {"rank": index + 1}))

    events = get_recent_events(user_id, limit=40)
    sessions: dict[str, list[dict]] = defaultdict(list)
    for event in events:
        sessions[event.get("context", {}).get("session_id") or event.get("session_id") or "ambient"].append(event)
    for session_id, session_events in list(sessions.items())[:8]:
        names = [f"{item.get('title')} by {item.get('artist')}" for item in session_events[:5] if item.get("title")]
        content = f"Session {session_id} moved through: {', '.join(names)}."
        chunks.append(_chunk_document(user_id, "listening_session", f"Session {session_id}", content, {"session_id": session_id, "event_count": len(session_events)}))

    genres = payload.get("genres") or []
    if genres:
        labels = [item.get("genre") if isinstance(item, dict) else str(item) for item in genres[:8]]
        chunks.append(_chunk_document(user_id, "genre_pattern", "Genre gravity", f"Your listening keeps returning to {', '.join(labels)}.", {"genres": labels}))

    audio = payload.get("audioFeatures") or {}
    analytics = payload.get("analyticsMetrics") or {}
    if audio or analytics:
        # audio.get(k, 0) returns None for present-but-None keys (Spotify
        # deprecated /audio-features → energy/valence/danceability are None), and
        # f"{None:.2f}" raises 'unsupported format string passed to NoneType'.
        # Use `or 0` so missing audio degrades to neutral instead of crashing.
        content = (
            f"Energy {audio.get('energy') or 0:.2f}, valence {audio.get('valence') or 0:.2f}, "
            f"danceability {audio.get('danceability') or 0:.2f}, mood {analytics.get('mood') or 'unknown'}."
        )
        chunks.append(_chunk_document(user_id, "mood_summary", "Mood and audio pattern", content, {"audio": audio, "analytics": analytics}))

    living_identity = payload.get("livingIdentity") or {}
    if living_identity.get("summary") or living_identity.get("receipts"):
        receipts = living_identity.get("receipts") or []
        content = living_identity.get("summary") or " ".join(receipts[:2])
        chunks.append(_chunk_document(
            user_id,
            "living_identity",
            living_identity.get("title") or "Living identity",
            content,
            {"receipts": receipts[:6], "phase": living_identity.get("currentPhase")},
        ))

    music_identity = payload.get("musicIdentity") or {}
    identity_type = music_identity.get("type") or {}
    if identity_type.get("name") or music_identity.get("axes") or music_identity.get("metrics"):
        axis_text = ", ".join(
            f"{axis.get('direction')} on {axis.get('left')}/{axis.get('right')}"
            for axis in (music_identity.get("axes") or [])[:4]
            if isinstance(axis, dict) and axis.get("direction")
        )
        metric_text = ", ".join(
            f"{metric.get('label')} {metric.get('pct')}%"
            for metric in (music_identity.get("topMetrics") or music_identity.get("metrics") or [])[:4]
            if isinstance(metric, dict) and metric.get("available", True)
        )
        content = (
            f"Music Identity: {identity_type.get('name', 'forming')}. "
            f"{music_identity.get('poeticLine') or identity_type.get('description') or ''} "
            f"Sonic axes: {axis_text or 'forming'}. Metrics: {metric_text or 'forming'}."
        )
        chunks.append(_chunk_document(
            user_id,
            "music_identity",
            identity_type.get("name") or "Music Identity",
            content,
            {
                "framework": music_identity.get("framework"),
                "axes": (music_identity.get("axes") or [])[:4],
                "metrics": (music_identity.get("topMetrics") or [])[:4],
                "confidence": music_identity.get("confidence", {}),
            },
        ))

    identity_signals = payload.get("identitySignals") or []
    for signal in identity_signals[:8]:
        if not isinstance(signal, dict) or not signal.get("available", True):
            continue
        evidence = signal.get("evidence") or []
        if not evidence:
            continue
        content = f"{signal.get('label')} reads {signal.get('pct')}%. Evidence: {' '.join(evidence[:3])}"
        chunks.append(_chunk_document(
            user_id,
            "identity_signal",
            signal.get("label") or signal.get("id") or "Identity signal",
            content,
            {
                "signal_id": signal.get("id"),
                "score": signal.get("score"),
                "confidence": signal.get("confidence"),
                "spotify_fields": signal.get("spotifyFields", []),
            },
        ))

    feedback_events = [event for event in events if str(event.get("type", "")).startswith("recommendation_")]
    if feedback_events:
        feedback_counter = Counter(event.get("type") for event in feedback_events)
        feedback_text = ", ".join(f"{key}: {value}" for key, value in feedback_counter.items())
        chunks.append(_chunk_document(user_id, "feedback_pattern", "Recommendation feedback", f"Your recent recommendation behavior includes {feedback_text}.", {"counts": dict(feedback_counter)}))

    listening_memory = payload.get("listeningMemory") or build_listening_memory_model(user_id, payload)
    if listening_memory.get("available"):
        for motif in (listening_memory.get("motifs") or [])[:5]:
            evidence = motif.get("evidence") or []
            chunks.append(_chunk_document(
                user_id,
                "listening_memory_motif",
                motif.get("label") or "Listening motif",
                " ".join(evidence[:3]) or motif.get("source") or "Recurring listening motif.",
                {"source": motif.get("source"), "evidence": evidence[:5]},
            ))
        if listening_memory.get("memoryStatements"):
            chunks.append(_chunk_document(
                user_id,
                "listening_memory_timeline",
                "Listening memory timeline",
                " ".join((listening_memory.get("memoryStatements") or [])[:4]),
                {
                    "comfortOrbit": listening_memory.get("comfortOrbit"),
                    "nightListening": listening_memory.get("nightListening"),
                    "historyDepth": listening_memory.get("historyDepth"),
                },
            ))

    personality = payload.get("personality") or []
    mbti = payload.get("mbti") or {}
    if personality or mbti:
        labels = [item.get("label") if isinstance(item, dict) else str(item) for item in personality[:3]]
        identity_name = ((payload.get("musicIdentity") or {}).get("type") or {}).get("name") or payload.get("sonicPersonalityTitle") or "forming"
        content = f"Identity snapshot with archetypes {', '.join(filter(None, labels)) or 'soft signal'} and Music Identity {identity_name}."
        chunks.append(_chunk_document(user_id, "identity_snapshot", "Identity snapshot", content, {"music_identity": identity_name, "legacy_code": mbti, "personality": personality[:3]}))

    # ── SIGNAL DEPTH: richer memory types ─────────────────────────────────
    now = datetime.now(UTC).isoformat()

    # recurring_artist — artists that appear repeatedly across events
    if events and top_artists:
        event_artists = [e.get("artist") or "" for e in events if e.get("artist")]
        artist_counts = Counter(a.lower() for a in event_artists if a)
        top_artist_names = {(a.get("name") or "").lower(): a for a in top_artists[:20] if isinstance(a, dict)}
        for artist_lower, count in artist_counts.most_common(5):
            if count < 2:
                break
            if artist_lower in top_artist_names:
                a_obj = top_artist_names[artist_lower]
                genres = ", ".join((a_obj.get("genres") or [])[:2])
                content = (
                    f"{a_obj.get('name', artist_lower)} appears {count} times in your recent event stream. "
                    f"Genres: {genres or 'unclassified'}. This is a recurring orbit."
                )
                chunks.append(_chunk_document(
                    user_id, "recurring_artist", a_obj.get("name", artist_lower), content,
                    {"count": count, "confidence": min(1.0, count / 10.0), "timestamp": now},
                ))

    # new_surge — artists in short-term but not previously dominant
    surge_artists = [a for a in top_artists[:20] if isinstance(a, dict) and (a.get("metrics") or {}).get("isSurge")]
    for sa in surge_artists[:4]:
        name = sa.get("name", "Unknown")
        genres = ", ".join((sa.get("genres") or [])[:2])
        content = (
            f"{name} is a new surge in your listening — not in your long-term orbit yet. "
            f"Genres: {genres or 'emerging'}. Your taste may be shifting."
        )
        chunks.append(_chunk_document(
            user_id, "new_surge", name, content,
            {"confidence": 0.72, "genres": (sa.get("genres") or [])[:3], "timestamp": now},
        ))

    # ghost_return — artists in long-term but not recent events (detected from payload)
    ghost_artists = [a for a in top_artists if isinstance(a, dict) and (a.get("metrics") or {}).get("isGhost")]
    for ga in ghost_artists[:4]:
        name = ga.get("name", "Unknown")
        content = (
            f"{name} is a former orbit — present in long-term listening but absent from recent activity. "
            f"This voice once mattered to you. It may matter again."
        )
        chunks.append(_chunk_document(
            user_id, "ghost_return", name, content,
            {"confidence": 0.64, "timestamp": now},
        ))

    # genre_shift — detect if recent listening differs from long-term genre pattern
    if events and genres:
        recent_genres_raw = [e.get("genre") or "" for e in events[:20] if e.get("genre")]
        if recent_genres_raw:
            recent_top = Counter(recent_genres_raw).most_common(3)
            long_term_top = [g.get("genre") if isinstance(g, dict) else str(g) for g in genres[:3]]
            recent_labels = [r[0] for r in recent_top]
            shifted = [g for g in recent_labels if g not in long_term_top]
            if shifted:
                content = (
                    f"Your recent listening leans toward {', '.join(shifted)}, "
                    f"which differs from your long-term pattern of {', '.join(long_term_top[:2])}. "
                    f"A genre shift is forming."
                )
                chunks.append(_chunk_document(
                    user_id, "genre_shift", "Genre shift detected", content,
                    {"recent": recent_labels, "long_term": long_term_top, "timestamp": now, "confidence": 0.58},
                ))

    # obsession_pattern — artist with highest event frequency
    if events:
        obs_counter = Counter(e.get("artist") or "" for e in events if e.get("artist"))
        if obs_counter:
            top_obs, top_obs_count = obs_counter.most_common(1)[0]
            if top_obs and top_obs_count >= 3:
                content = (
                    f"{top_obs} dominates your recent listening with {top_obs_count} events. "
                    f"Your attention keeps bending back here — this is a gravity pattern."
                )
                chunks.append(_chunk_document(
                    user_id, "obsession_pattern", top_obs, content,
                    {"count": top_obs_count, "confidence": min(1.0, top_obs_count / 8.0), "timestamp": now},
                ))

    # listening_streak — consecutive sessions dominated by same mood/artist
    if len(events) >= 6:
        moods = [e.get("mood") or e.get("audio_features", {}).get("mood") or "" for e in events[:12]]
        non_empty = [m for m in moods if m]
        if non_empty:
            streak_mood = Counter(non_empty).most_common(1)[0][0]
            streak_count = sum(1 for m in moods if m == streak_mood)
            if streak_count >= 4:
                content = (
                    f"You have been in a {streak_mood} listening streak — "
                    f"{streak_count} of your last {min(12, len(events))} events carry this mood signature."
                )
                chunks.append(_chunk_document(
                    user_id, "listening_streak", f"{streak_mood} streak", content,
                    {"mood": streak_mood, "count": streak_count, "timestamp": now, "confidence": 0.65},
                ))

    # mood_weather — current emotional climate from recent audio features
    recent_with_af = [e for e in events[:20] if isinstance(e.get("audio_features"), dict)]
    if recent_with_af:
        avg_valence   = sum((e["audio_features"].get("valence") or 0.5) for e in recent_with_af) / len(recent_with_af)
        avg_energy    = sum((e["audio_features"].get("energy")  or 0.5) for e in recent_with_af) / len(recent_with_af)
        brightness    = "bright" if avg_valence > 0.6 else ("dark" if avg_valence < 0.4 else "mid-range")
        intensity     = "intense" if avg_energy > 0.6 else ("quiet" if avg_energy < 0.4 else "moderate")
        weather_label = f"{brightness}-{intensity}"
        content = (
            f"Current listening weather: {brightness} ({avg_valence:.2f} valence) and {intensity} ({avg_energy:.2f} energy). "
            f"The emotional climate of your recent orbit is {weather_label}."
        )
        chunks.append(_chunk_document(
            user_id, "mood_weather", "Current listening weather", content,
            {"valence": round(avg_valence, 3), "energy": round(avg_energy, 3), "label": weather_label, "timestamp": now},
        ))

    return chunks


def retrieve_memory_chunks(user_id: str, query: str, limit: int = 8, profile: dict | None = None) -> dict:
    chunks = list_auralith_chunks(user_id, limit=200)
    if not chunks:
        chunks = build_memory_chunks(user_id, profile=profile)
    if not chunks:
        return {"chunks": [], "confidence": 0.18, "source_types": [], "explanation": "No listening memory has been indexed yet."}

    query_vector = embed_tokens(_tokens(query), salt="auralith:query")
    scored = []
    for chunk in chunks:
        embedding = chunk.get("vector") or embed_tokens(
            _tokens(f"{chunk.get('title')} {chunk.get('content')}"),
            salt=f"auralith:{chunk.get('source_type')}",
        )
        score = cosine_similarity(query_vector, embedding)
        scored.append({**chunk, "score": score})
    scored.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    top = scored[:limit]
    source_types = sorted({item.get("source_type", "memory") for item in top})
    confidence = round(min(0.92, 0.3 + len(top) * 0.05 + max((item.get("score", 0.0) for item in top), default=0.0) * 0.35), 3)
    return {
        "chunks": top,
        "confidence": confidence,
        "source_types": source_types,
        "explanation": "Auralith searched your stored listening memories, recent sessions, genre gravity, and identity snapshots to ground this answer.",
        "indexed_at": datetime.now(UTC).isoformat(),
    }

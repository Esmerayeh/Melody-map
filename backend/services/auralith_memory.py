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
        content = (
            f"Energy {audio.get('energy', 0):.2f}, valence {audio.get('valence', 0):.2f}, "
            f"danceability {audio.get('danceability', 0):.2f}, mood {analytics.get('mood', 'unknown')}."
        )
        chunks.append(_chunk_document(user_id, "mood_summary", "Mood and audio pattern", content, {"audio": audio, "analytics": analytics}))

    feedback_events = [event for event in events if str(event.get("type", "")).startswith("recommendation_")]
    if feedback_events:
        feedback_counter = Counter(event.get("type") for event in feedback_events)
        feedback_text = ", ".join(f"{key}: {value}" for key, value in feedback_counter.items())
        chunks.append(_chunk_document(user_id, "feedback_pattern", "Recommendation feedback", f"Your recent recommendation behavior includes {feedback_text}.", {"counts": dict(feedback_counter)}))

    personality = payload.get("personality") or []
    mbti = payload.get("mbti") or {}
    if personality or mbti:
        labels = [item.get("label") if isinstance(item, dict) else str(item) for item in personality[:3]]
        content = f"Identity snapshot with archetypes {', '.join(filter(None, labels)) or 'soft signal'} and MBTI {mbti.get('type', 'unknown')}."
        chunks.append(_chunk_document(user_id, "identity_snapshot", "Identity snapshot", content, {"mbti": mbti, "personality": personality[:3]}))

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

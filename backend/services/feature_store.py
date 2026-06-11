from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime

from utils.online_cache import read_live_signal, write_live_signal
from utils.logger import logger


SNAPSHOT_SCHEMA_VERSION = "2026-04-feature-store-v1"
ONLINE_FEATURE_SCHEMA_VERSION = "2026-04-online-features-v1"
OFFLINE_FEATURE_SCHEMA_VERSION = "2026-04-offline-features-v1"
THREAD_SCHEMA_VERSION = "2026-04-auralith-threads-v1"
SOCIAL_GRAPH_SCHEMA_VERSION = "2026-04-social-graph-v1"
_mongo = None
_local_events: dict[str, dict] = {}
_local_online_features: dict[str, dict] = {}
_local_offline_features: dict[tuple[str, str], dict] = {}
_local_embeddings: dict[tuple[str, str, str], dict] = {}
_local_snapshots: dict[str, dict] = {}
_local_auralith_chunks: dict[str, dict] = {}
_local_identity_snapshots: dict[tuple[str, str], dict] = {}
_local_social_public_profiles: dict[str, dict] = {}
_local_soulmate_requests: dict[str, dict] = {}
_local_soulmate_matches: dict[str, dict] = {}


def init_mongo(mongo_instance):
    global _mongo
    _mongo = mongo_instance
    try:
        _mongo.db.profile_snapshots.create_index("snapshot_id", unique=True)
        _mongo.db.profile_snapshots.create_index([("user_id", 1), ("captured_at", -1)])
        _mongo.db.listening_events.create_index("event_id", unique=True)
        _mongo.db.listening_events.create_index([("user_id", 1), ("timestamp", -1)])
        _mongo.db.online_features.create_index("user_id", unique=True)
        _mongo.db.offline_features.create_index([("user_id", 1), ("window", 1)], unique=True)
        _mongo.db.embedding_registry.create_index([("entity_type", 1), ("entity_id", 1), ("embedding_version", 1)], unique=True)
        _mongo.db.auralith_threads.create_index([("user_id", 1), ("thread_id", 1)], unique=True)
        _mongo.db.social_profiles.create_index("user_id", unique=True)
        _mongo.db.social_edges.create_index([("source_user_id", 1), ("target_user_id", 1), ("edge_type", 1)], unique=True)
        _mongo.db.co_curation_artifacts.create_index([("owner_user_id", 1), ("created_at", -1)])
        _mongo.db.auralith_chunks.create_index([("user_id", 1), ("chunk_id", 1)], unique=True)
        _mongo.db.auralith_chunks.create_index([("user_id", 1), ("source_type", 1), ("updated_at", -1)])
        _mongo.db.identity_snapshots.create_index([("user_id", 1), ("range_key", 1)], unique=True)
        _mongo.db.social_public_profiles.create_index("user_id", unique=True)
        _mongo.db.social_public_profiles.create_index("public_slug", unique=True, sparse=True)
        _mongo.db.soulmate_requests.create_index("request_id", unique=True)
        _mongo.db.soulmate_matches.create_index("match_id", unique=True)
    except Exception:
        pass


def _stable_hash(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _stable_public_slug(display_name: str | None, user_id: str) -> str:
    suffix = str(user_id)[-6:] or "signal"
    base = re.sub(r"[^a-z0-9]+", "-", (display_name or "").lower()).strip("-")
    return f"{base}-{suffix}" if base else f"user-{suffix}"


def register_profile_snapshot(profile: dict, user_id: str | None = None, provider_user_id: str | None = None) -> dict:
    base_payload = {
        "profileSchemaVersion": profile.get("profileSchemaVersion"),
        "provider": profile.get("provider"),
        "timeRange": profile.get("timeRange"),
        "topArtists": (profile.get("topArtists") or [])[:20],
        "topTracks": (profile.get("topTracks") or [])[:20],
        "genres": (profile.get("genres") or [])[:20],
        "audioFeatures": profile.get("audioFeatures", {}),
        "analyticsMetrics": profile.get("analyticsMetrics", {}),
        "identitySignals": profile.get("identitySignals", []),
        "musicIdentity": profile.get("musicIdentity", {}),
        "sonicAxes": profile.get("sonicAxes", []),
        "identityMetrics": profile.get("identityMetrics", []),
        "sonicField": profile.get("sonicField", {}),
        "livingIdentity": profile.get("livingIdentity", {}),
        "listeningMemory": profile.get("listeningMemory", {}),
        "spotifyEvidence": profile.get("spotifyEvidence", {}),
        "recommendationContext": profile.get("recommendationContext", {}),
        "identityDNA": profile.get("identityDNA", []),
        "soulOrbProfile": profile.get("soulOrbProfile", {}),
        "personality": (profile.get("personality") or [])[:10],
        "mbti": profile.get("mbti", {}),
        "aesthetic": profile.get("aesthetic"),
        "representations": profile.get("representations", {}),
        "galaxyTopology": profile.get("galaxyTopology", {}),
        "confidence": profile.get("confidence", {}),
        "dataQuality": profile.get("dataQuality", {}),
    }
    snapshot_id = _stable_hash(base_payload)
    snapshot = {
        "snapshot_id": snapshot_id,
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "user_id": user_id,
        "provider_user_id": provider_user_id,
        "provider": profile.get("provider"),
        "profile_schema_version": profile.get("profileSchemaVersion"),
        "captured_at": datetime.now(UTC),
        "payload": base_payload,
    }
    if _mongo is not None:
        _mongo.db.profile_snapshots.update_one({"snapshot_id": snapshot_id}, {"$set": snapshot}, upsert=True)
    else:
        _local_snapshots[snapshot_id] = snapshot
    logger.info({"event": "profile_snapshot_registered", "snapshot_id": snapshot_id, "user_id": user_id})
    return {"snapshotId": snapshot_id, "schemaVersion": SNAPSHOT_SCHEMA_VERSION}


def store_listening_event(user_id: str, payload: dict, *, event_id: str | None = None) -> dict:
    event = {
        "event_id": event_id or _stable_hash({"user_id": user_id, **payload}),
        "user_id": user_id,
        "type": payload.get("type", "listening"),
        "track_id": payload.get("track_id"),
        "artist": payload.get("artist"),
        "title": payload.get("title"),
        "context": payload.get("context", {}),
        "timestamp": payload.get("timestamp") or datetime.now(UTC).isoformat(),
        "received_at": datetime.now(UTC),
    }
    for key in ("album", "preview_url", "spotify_url", "played_at", "audio_features"):
        if payload.get(key) is not None:
            event[key] = payload.get(key)
    if _mongo is not None:
        existing = _mongo.db.listening_events.find_one({"event_id": event["event_id"]})
        _mongo.db.listening_events.update_one({"event_id": event["event_id"]}, {"$setOnInsert": event}, upsert=True)
        event["_inserted"] = existing is None
    else:
        event["_inserted"] = event["event_id"] not in _local_events
        _local_events.setdefault(event["event_id"], event)
    return event


def _serialize_event_track(event: dict) -> str | None:
    title = (event.get("title") or "").strip()
    artist = (event.get("artist") or "").strip()
    track_id = (event.get("track_id") or "").strip()
    if track_id:
        return track_id
    if title and artist:
        return f"{title}::{artist}"
    if title:
        return title
    return None


def get_recent_events(user_id: str, limit: int = 25) -> list[dict]:
    if _mongo is None:
        events = [event for event in _local_events.values() if event.get("user_id") == user_id]
        return sorted(events, key=lambda item: item.get("received_at", datetime.now(UTC)), reverse=True)[:limit]
    events = list(_mongo.db.listening_events.find({"user_id": user_id}).sort("received_at", -1).limit(limit))
    for event in events:
        event.pop("_id", None)
    return events


def summarize_live_signal(user_id: str, limit: int = 20) -> dict:
    events = get_recent_events(user_id, limit=limit)
    if not events:
        return {
            "eventCount": 0,
            "sessionIntensity": 0.0,
            "noveltyScore": 0.0,
            "repeatScore": 0.0,
            "activeTracks": [],
            "recentEvents": [],
            "updatedAt": datetime.now(UTC).isoformat(),
        }

    track_keys = [key for key in (_serialize_event_track(event) for event in events) if key]
    unique_tracks = sorted(set(track_keys))
    repeat_score = round(1.0 - (len(unique_tracks) / max(len(track_keys), 1)), 3)
    novelty_score = round(len(unique_tracks) / max(len(track_keys), 1), 3)
    session_intensity = round(min(1.0, len(events) / 12.0), 3)
    active_tracks = []
    seen = set()
    for event in events:
        label = " - ".join(part for part in [(event.get("title") or "").strip(), (event.get("artist") or "").strip()] if part)
        if not label or label in seen:
            continue
        seen.add(label)
        active_tracks.append(label)
        if len(active_tracks) >= 5:
            break

    return {
        "eventCount": len(events),
        "sessionIntensity": session_intensity,
        "noveltyScore": novelty_score,
        "repeatScore": repeat_score,
        "activeTracks": active_tracks,
        "recentEvents": events[:8],
        "updatedAt": datetime.now(UTC).isoformat(),
    }


def upsert_online_features(user_id: str, live_signal: dict, *, source_event_id: str | None = None) -> dict:
    document = {
        "user_id": user_id,
        "schema_version": ONLINE_FEATURE_SCHEMA_VERSION,
        "source_event_id": source_event_id,
        "updated_at": datetime.now(UTC),
        "live_signal": live_signal,
    }
    if _mongo is not None:
        _mongo.db.online_features.update_one({"user_id": user_id}, {"$set": document}, upsert=True)
    else:
        _local_online_features[user_id] = document
    return document


def get_live_signal_cached(user_id: str) -> dict | None:
    cached = read_live_signal(user_id)
    if cached:
        return cached
    online = get_online_features(user_id)
    if online and online.get("live_signal"):
        write_live_signal(user_id, online["live_signal"])
        return online["live_signal"]
    return None


def upsert_online_features_cached(user_id: str, live_signal: dict, *, source_event_id: str | None = None) -> dict:
    write_live_signal(user_id, live_signal)
    return upsert_online_features(user_id, live_signal, source_event_id=source_event_id)


def get_online_features(user_id: str) -> dict | None:
    if _mongo is None:
        return _local_online_features.get(user_id)
    doc = _mongo.db.online_features.find_one({"user_id": user_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def upsert_offline_features(user_id: str, window: str, payload: dict) -> dict:
    document = {
        "user_id": user_id,
        "window": window,
        "schema_version": OFFLINE_FEATURE_SCHEMA_VERSION,
        "updated_at": datetime.now(UTC),
        "payload": payload,
    }
    if _mongo is not None:
        _mongo.db.offline_features.update_one(
            {"user_id": user_id, "window": window},
            {"$set": document},
            upsert=True,
        )
    else:
        _local_offline_features[(user_id, window)] = document
    return document


def get_offline_features(user_id: str, window: str = "rolling_30d") -> dict | None:
    if _mongo is None:
        return _local_offline_features.get((user_id, window))
    doc = _mongo.db.offline_features.find_one({"user_id": user_id, "window": window})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def register_embedding(entity_type: str, entity_id: str, embedding_version: str, vector: list[float], metadata: dict | None = None) -> dict:
    document = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "embedding_version": embedding_version,
        "vector": vector,
        "metadata": metadata or {},
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.embedding_registry.update_one(
            {"entity_type": entity_type, "entity_id": entity_id, "embedding_version": embedding_version},
            {"$set": document},
            upsert=True,
        )
    else:
        _local_embeddings[(entity_type, entity_id, embedding_version)] = document
    return document


def get_embedding(entity_type: str, entity_id: str, embedding_version: str | None = None) -> dict | None:
    if _mongo is None:
        matches = [
            document
            for (stored_type, stored_entity_id, stored_version), document in _local_embeddings.items()
            if stored_type == entity_type and stored_entity_id == entity_id and (embedding_version is None or stored_version == embedding_version)
        ]
        if not matches:
            return None
        return sorted(matches, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)), reverse=True)[0]
    query = {"entity_type": entity_type, "entity_id": entity_id}
    if embedding_version:
        query["embedding_version"] = embedding_version
    doc = _mongo.db.embedding_registry.find_one(query, sort=[("updated_at", -1)])
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def list_embeddings(entity_type: str, embedding_version: str | None = None, limit: int = 1000) -> list[dict]:
    if _mongo is None:
        matches = [
            document
            for (stored_type, _stored_entity_id, stored_version), document in _local_embeddings.items()
            if stored_type == entity_type and (embedding_version is None or stored_version == embedding_version)
        ]
        return sorted(matches, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)), reverse=True)[:limit]
    query = {"entity_type": entity_type}
    if embedding_version:
        query["embedding_version"] = embedding_version
    docs = list(_mongo.db.embedding_registry.find(query).sort("updated_at", -1).limit(limit))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def upsert_auralith_chunk(user_id: str, chunk: dict) -> dict:
    document = {
        "chunk_id": chunk.get("chunk_id") or _stable_hash({"user_id": user_id, **chunk}),
        "user_id": user_id,
        "source_type": chunk.get("source_type", "memory"),
        "title": chunk.get("title"),
        "content": chunk.get("content", ""),
        "metadata": chunk.get("metadata") or {},
        "embedding_version": chunk.get("embedding_version"),
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.auralith_chunks.update_one(
            {"user_id": user_id, "chunk_id": document["chunk_id"]},
            {"$set": document},
            upsert=True,
        )
    else:
        _local_auralith_chunks[document["chunk_id"]] = document
    return document


def list_auralith_chunks(user_id: str, source_type: str | None = None, limit: int = 200) -> list[dict]:
    if _mongo is None:
        docs = [doc for doc in _local_auralith_chunks.values() if doc.get("user_id") == user_id and (not source_type or doc.get("source_type") == source_type)]
        return sorted(docs, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)), reverse=True)[:limit]
    query = {"user_id": user_id}
    if source_type:
        query["source_type"] = source_type
    docs = list(_mongo.db.auralith_chunks.find(query).sort("updated_at", -1).limit(limit))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def upsert_identity_snapshot(user_id: str, range_key: str, payload: dict) -> dict:
    document = {
        "user_id": user_id,
        "range_key": range_key,
        "payload": payload,
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.identity_snapshots.update_one(
            {"user_id": user_id, "range_key": range_key},
            {"$set": document},
            upsert=True,
        )
    else:
        _local_identity_snapshots[(user_id, range_key)] = document
    return document


def list_identity_snapshots(user_id: str) -> list[dict]:
    if _mongo is None:
        docs = [doc for (uid, _range), doc in _local_identity_snapshots.items() if uid == user_id]
        return sorted(docs, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)))
    docs = list(_mongo.db.identity_snapshots.find({"user_id": user_id}).sort("updated_at", 1))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def upsert_social_public_profile(user_id: str, payload: dict) -> dict:
    display_name = payload.get("display_name")
    public_slug = payload.get("public_slug") or _stable_public_slug(display_name, user_id)
    document = {
        "user_id": user_id,
        "public_slug": public_slug,
        "display_name": display_name,
        "visibility": payload.get("visibility", "private"),
        "allow_matching": bool(payload.get("allow_matching", False)),
        "summary": payload.get("summary"),
        "top_artists": (payload.get("top_artists") or [])[:12],
        "top_genres": (payload.get("top_genres") or [])[:12],
        "mood_vector": payload.get("mood_vector") or {},
        "representations": payload.get("representations") or {},
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.social_public_profiles.update_one({"user_id": user_id}, {"$set": document}, upsert=True)
    else:
        _local_social_public_profiles[user_id] = document
    return document


def get_social_public_profile(user_id: str) -> dict | None:
    if _mongo is None:
        return _local_social_public_profiles.get(user_id)
    doc = _mongo.db.social_public_profiles.find_one({"user_id": user_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def get_social_public_profile_by_slug(public_slug: str) -> dict | None:
    public_slug = (public_slug or "").strip()
    if not public_slug:
        return None
    if _mongo is None:
        return next((doc for doc in _local_social_public_profiles.values() if doc.get("public_slug") == public_slug), None)
    doc = _mongo.db.social_public_profiles.find_one({"public_slug": public_slug})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def list_social_public_profiles(limit: int = 100) -> list[dict]:
    if _mongo is None:
        docs = list(_local_social_public_profiles.values())
        return sorted(docs, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)), reverse=True)[:limit]
    docs = list(_mongo.db.social_public_profiles.find({"allow_matching": True}).sort("updated_at", -1).limit(limit))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def create_soulmate_request(source_user_id: str, target_user_id: str, payload: dict | None = None) -> dict:
    document = {
        "request_id": _stable_hash({"source_user_id": source_user_id, "target_user_id": target_user_id, "payload": payload or {}}),
        "source_user_id": source_user_id,
        "target_user_id": target_user_id,
        "status": "pending",
        "payload": payload or {},
        "updated_at": datetime.now(UTC),
        "created_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.soulmate_requests.update_one({"request_id": document["request_id"]}, {"$set": document}, upsert=True)
    else:
        _local_soulmate_requests[document["request_id"]] = document
    return document


def accept_soulmate_request(request_id: str) -> dict | None:
    if _mongo is None:
        doc = _local_soulmate_requests.get(request_id)
        if not doc:
            return None
        doc["status"] = "accepted"
        doc["updated_at"] = datetime.now(UTC)
        return doc
    doc = _mongo.db.soulmate_requests.find_one({"request_id": request_id})
    if not doc:
        return None
    _mongo.db.soulmate_requests.update_one({"request_id": request_id}, {"$set": {"status": "accepted", "updated_at": datetime.now(UTC)}})
    doc["status"] = "accepted"
    doc.pop("_id", None)
    return doc


def list_soulmate_requests(user_id: str, status: str | None = None) -> list[dict]:
    if _mongo is None:
        docs = [
            doc for doc in _local_soulmate_requests.values()
            if (doc.get("source_user_id") == user_id or doc.get("target_user_id") == user_id) and (not status or doc.get("status") == status)
        ]
        return sorted(docs, key=lambda item: item.get("updated_at", datetime.min.replace(tzinfo=UTC)), reverse=True)
    query = {"$or": [{"source_user_id": user_id}, {"target_user_id": user_id}]}
    if status:
        query["status"] = status
    docs = list(_mongo.db.soulmate_requests.find(query).sort("updated_at", -1))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def upsert_soulmate_match(left_user_id: str, right_user_id: str, payload: dict) -> dict:
    pair = sorted([left_user_id, right_user_id])
    document = {
        "match_id": _stable_hash({"pair": pair}),
        "left_user_id": pair[0],
        "right_user_id": pair[1],
        "payload": payload,
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.soulmate_matches.update_one({"match_id": document["match_id"]}, {"$set": document}, upsert=True)
    else:
        _local_soulmate_matches[document["match_id"]] = document
    return document


def save_auralith_message(user_id: str, thread_id: str, role: str, content: dict) -> dict:
    message = {
        "message_id": _stable_hash(
            {"user_id": user_id, "thread_id": thread_id, "role": role, "content": content, "ts": datetime.now(UTC).isoformat()}
        ),
        "role": role,
        "content": content,
        "created_at": datetime.now(UTC),
    }
    base = {
        "user_id": user_id,
        "thread_id": thread_id,
        "schema_version": THREAD_SCHEMA_VERSION,
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.auralith_threads.update_one(
            {"user_id": user_id, "thread_id": thread_id},
            {
                "$setOnInsert": {"created_at": datetime.now(UTC)},
                "$set": base,
                "$push": {"messages": message},
            },
            upsert=True,
        )
    return message


def get_auralith_thread(user_id: str, thread_id: str) -> dict | None:
    if _mongo is None:
        return None
    doc = _mongo.db.auralith_threads.find_one({"user_id": user_id, "thread_id": thread_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def list_auralith_threads(user_id: str, limit: int = 10) -> list[dict]:
    if _mongo is None:
        return []
    docs = list(_mongo.db.auralith_threads.find({"user_id": user_id}).sort("updated_at", -1).limit(limit))
    for doc in docs:
        doc.pop("_id", None)
    return docs


def upsert_social_profile(user_id: str, payload: dict) -> dict:
    document = {
        "user_id": user_id,
        "schema_version": SOCIAL_GRAPH_SCHEMA_VERSION,
        "visibility": payload.get("visibility", "private"),
        "allow_matching": bool(payload.get("allow_matching", True)),
        "allow_public_artifacts": bool(payload.get("allow_public_artifacts", False)),
        "allow_co_curation": bool(payload.get("allow_co_curation", True)),
        "display_name": payload.get("display_name"),
        "bio": payload.get("bio"),
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.social_profiles.update_one({"user_id": user_id}, {"$set": document}, upsert=True)
    return document


def get_social_profile(user_id: str) -> dict | None:
    if _mongo is None:
        return None
    doc = _mongo.db.social_profiles.find_one({"user_id": user_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def upsert_social_edge(source_user_id: str, target_user_id: str, edge_type: str, payload: dict | None = None) -> dict:
    edge = {
        "source_user_id": source_user_id,
        "target_user_id": target_user_id,
        "edge_type": edge_type,
        "payload": payload or {},
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.social_edges.update_one(
            {"source_user_id": source_user_id, "target_user_id": target_user_id, "edge_type": edge_type},
            {"$set": edge},
            upsert=True,
        )
    return edge


def get_social_edges(user_id: str, limit: int = 50) -> list[dict]:
    if _mongo is None:
        return []
    docs = list(
        _mongo.db.social_edges.find({"$or": [{"source_user_id": user_id}, {"target_user_id": user_id}]})
        .sort("updated_at", -1)
        .limit(limit)
    )
    for doc in docs:
        doc.pop("_id", None)
    return docs


def create_co_curation_artifact(owner_user_id: str, payload: dict) -> dict:
    artifact = {
        "artifact_id": _stable_hash({"owner_user_id": owner_user_id, **payload}),
        "owner_user_id": owner_user_id,
        "partner_user_id": payload.get("partner_user_id"),
        "title": payload.get("title") or "Co-curation ritual",
        "seed_tracks": (payload.get("seed_tracks") or [])[:20],
        "notes": payload.get("notes"),
        "visibility": payload.get("visibility", "private"),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    if _mongo is not None:
        _mongo.db.co_curation_artifacts.update_one(
            {"artifact_id": artifact["artifact_id"]},
            {"$set": artifact},
            upsert=True,
        )
    return artifact


def list_co_curation_artifacts(user_id: str, limit: int = 20) -> list[dict]:
    if _mongo is None:
        return []
    docs = list(
        _mongo.db.co_curation_artifacts.find(
            {"$or": [{"owner_user_id": user_id}, {"partner_user_id": user_id}, {"visibility": "public"}]}
        )
        .sort("updated_at", -1)
        .limit(limit)
    )
    for doc in docs:
        doc.pop("_id", None)
    return docs


def get_latest_snapshot(user_id: str) -> dict | None:
    if _mongo is None:
        matches = [
            document
            for document in _local_snapshots.values()
            if document.get("user_id") == user_id or document.get("provider_user_id") == user_id
        ]
        if not matches:
            return None
        return sorted(matches, key=lambda item: item.get("captured_at", datetime.min.replace(tzinfo=UTC)), reverse=True)[0]
    doc = _mongo.db.profile_snapshots.find_one(
        {"$or": [{"user_id": user_id}, {"provider_user_id": user_id}]},
        sort=[("captured_at", -1)],
    )
    if not doc:
        return None
    doc.pop("_id", None)
    return doc

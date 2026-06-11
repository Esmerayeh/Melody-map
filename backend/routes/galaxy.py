"""
Galaxy API routes — Semantic Layout v1
---------------------------------------
POST /api/galaxy/build
    Builds a semantically-positioned galaxy artifact from a profile payload.

    Axis semantics (matches frontend galaxyScoring.buildSemanticPosition):
      x = valence   (dark/melancholic ← 0 → bright/joyful)
      y = energy    (quiet/ambient   ← 0 → loud/intense)
      z = texture   (electronic/kinetic ← 0 → organic/still)

    Distance between any two artist nodes in 3-D space reflects their
    actual audio feature similarity, not random assignment.

POST /api/galaxy/jobs
    Enqueues as background job.
"""
from __future__ import annotations

import hashlib
import math
import random
from typing import Any

from flask import Blueprint, request

from middleware.auth import optional_auth
from utils.api import api_error, api_success
from utils.jobs import job_registry
from utils.logger import logger

galaxy_bp = Blueprint("galaxy", __name__)

LAYOUT_METHOD      = "audio-feature-projection-v1"
LAYOUT_VERSION     = "audio-feature-semantic-v1"
COORDINATE_MEANING = {
    "x": "valence — emotional brightness: dark/melancholic (−) ↔ bright/joyful (+)",
    "y": "energy — intensity: quiet/ambient (−) ↔ loud/intense (+)",
    "z": "texture — electronic/kinetic (−) ↔ organic/still (+)",
}
SIMILARITY_BASIS = "euclidean distance in [valence, energy, organic-texture] audio-feature space"

# ─────────────────────────────────────────────────────────────────────────────
# Deterministic jitter helper (mirrors seededOffset in galaxyScoring.js)
# ─────────────────────────────────────────────────────────────────────────────

_GENRE_PALETTE: list[str] = [
    "#B994FF", "#9DB7FF", "#F0C8FF", "#EAE6FF",
    "#FFD580", "#FF9DB4", "#80FFD4", "#80C8FF",
    "#D4B0FF", "#FFBF96", "#96FFDA", "#C8DCFF",
]


def _stable_hash(text: str) -> int:
    h = 0
    for ch in str(text):
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
    return h


def _seeded_offset(seed: str, scale: float = 1.0) -> dict:
    n = _stable_hash(seed)
    x = ((n % 997) / 997.0) - 0.5
    y = (((n >> 3) % 991) / 991.0) - 0.5
    z = (((n >> 7) % 983) / 983.0) - 0.5
    return {"x": x * scale, "y": y * scale, "z": z * scale}


def _genre_color(genre: str) -> str:
    idx = int(hashlib.sha256(genre.encode()).hexdigest()[:4], 16) % len(_GENRE_PALETTE)
    return _GENRE_PALETTE[idx]


def _artist_color(name: str, genres: list[str]) -> str:
    return _genre_color(genres[0] if genres else name)


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(v) if v is not None else 0.5))


# ─────────────────────────────────────────────────────────────────────────────
# Semantic position builder (mirrors buildSemanticPosition in galaxyScoring.js)
# ─────────────────────────────────────────────────────────────────────────────

def _build_semantic_position(
    features: dict,
    jitter_seed: str = "",
    jitter_scale: float = 0.9,
    radial_boost: float = 1.0,
) -> dict:
    """
    Convert audio features to a 3-D galaxy coordinate.
    Same axis semantics as the JavaScript implementation.
    """
    v = _clamp(features.get("valence",       0.5))
    e = _clamp(features.get("energy",        0.5))
    a = _clamp(features.get("acousticness",  0.5))
    d = _clamp(features.get("danceability",  0.5))
    organic = a * 0.6 + (1 - d) * 0.4

    j = _seeded_offset(jitter_seed or "default", jitter_scale)
    return {
        "x": round((v - 0.5) * 18 * radial_boost + j["x"], 2),
        "y": round((e - 0.5) * 15 * radial_boost + j["y"], 2),
        "z": round((organic - 0.5) * 13 * radial_boost + j["z"], 2),
    }


def _average_features(feature_list: list[dict]) -> dict | None:
    """Average a list of audio feature dicts.  Returns None if empty."""
    if not feature_list:
        return None
    keys = ["valence", "energy", "acousticness", "danceability", "instrumentalness"]
    result: dict[str, float | None] = {}
    for k in keys:
        vals = [f[k] for f in feature_list if isinstance(f.get(k), (int, float))]
        result[k] = sum(vals) / len(vals) if vals else None
    return result


def _avg_position(positions: list[dict]) -> dict:
    if not positions:
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    return {
        "x": sum(p.get("x", 0) for p in positions) / len(positions),
        "y": sum(p.get("y", 0) for p in positions) / len(positions),
        "z": sum(p.get("z", 0) for p in positions) / len(positions),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main artifact builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_galaxy_artifact(profile: dict, idempotency_key: str) -> dict:
    """
    Build a semantically-positioned galaxy artifact from a profile payload.
    Returns the same schema the frontend normalizeArtifact() expects.
    """
    nodes: list[dict] = []
    edges: list[dict] = []

    raw_genres   = profile.get("genres", [])
    raw_artists  = profile.get("topArtists", [])
    raw_tracks   = profile.get("topTracks",  [])
    audio        = profile.get("audioFeatures", {}) or {}

    genre_list = [
        (g["genre"] if isinstance(g, dict) else g)
        for g in raw_genres[:10]
    ]

    # ── Build genre→artist feature lookup ────────────────────────────────────
    # Collect audio features per genre from artists so genre nodes can be
    # positioned semantically (mirrors buildGenreAnchors in galaxyBuilder.js).
    genre_feature_map: dict[str, list[dict]] = {}
    for artist in raw_artists[:40]:
        af = artist.get("audio_features") or {}
        if not isinstance(af, dict) or not any(af.values()):
            continue
        for g in (artist.get("genres") or []):
            key = g.lower()
            genre_feature_map.setdefault(key, []).append(af)

    # ── Genre nodes ──────────────────────────────────────────────────────────
    genre_positions: dict[str, dict] = {}
    semantic_genre_count = 0

    for i, genre in enumerate(genre_list):
        slug   = genre.lower().replace(" ", "-")
        color  = _genre_color(genre)
        weight = raw_genres[i].get("weight", 0.5) if isinstance(raw_genres[i], dict) else 0.5

        member_features = genre_feature_map.get(genre.lower(), [])
        avg_af = _average_features(member_features) if len(member_features) >= 2 else None

        if avg_af and avg_af.get("valence") is not None and avg_af.get("energy") is not None:
            # SEMANTIC positioning from member artists' audio features
            sem = _build_semantic_position(avg_af, f"genre:{genre}", jitter_scale=0.7)
            j   = _seeded_offset(f"genre-spread:{genre}", 0.5)
            pos = {
                "x": round(sem["x"] * 0.88 + j["x"], 2),
                "y": round(sem["y"] * 0.88 + j["y"], 2),
                "z": round(sem["z"] * 0.88 + j["z"], 2),
            }
            layout_basis = "semantic-audio-features"
            semantic_genre_count += 1
        else:
            # FALLBACK: deterministic ring
            angle  = (i / max(len(genre_list), 1)) * math.pi * 2
            radius = 9 + weight * 5
            j      = _seeded_offset(f"genre:{genre}", 0.9)
            pos = {
                "x": round(math.cos(angle) * radius + j["x"], 2),
                "y": round(j["y"] * 0.7, 2),
                "z": round(math.sin(angle) * radius + j["z"], 2),
            }
            layout_basis = "deterministic-ring-fallback"

        genre_positions[slug] = pos
        nodes.append({
            "id":           f"genre:{slug}",
            "type":         "genre",
            "label":        genre,
            "color":        color,
            "size":         round(0.55 + weight * 0.7, 2),
            "position":     pos,
            "audioFeatures": avg_af or {},
            "metrics":      {"significance": float(weight), "anchorScore": float(weight)},
            "role":         "nebula-anchor",
            "layoutBasis":  layout_basis,
        })

    # ── Artist nodes ─────────────────────────────────────────────────────────
    artist_node_map: dict[str, dict] = {}
    semantic_artist_count = 0

    for i, artist in enumerate(raw_artists[:40]):
        name       = artist.get("name", "")
        artist_id  = artist.get("id") or f"artist:{name.lower().replace(' ', '-')}"
        popularity = _clamp(artist.get("popularity", 50) / 100.0)
        genres     = artist.get("genres") or []
        color      = _artist_color(name, genres)
        is_surge   = bool((artist.get("metrics") or {}).get("isSurge"))
        is_ghost   = bool((artist.get("metrics") or {}).get("isGhost"))

        # Resolve audio features
        own_af  = artist.get("audio_features") or {}
        has_own = isinstance(own_af, dict) and any(v is not None for v in own_af.values())
        features = own_af if has_own else audio

        # Discovery boost: less-known artists pushed outward
        discovery = 1.0 - popularity
        radial_boost = 0.85 + discovery * 0.65
        jitter_scale = 0.75 if has_own else 1.1

        sem = _build_semantic_position(features, artist_id or name, jitter_scale=jitter_scale, radial_boost=radial_boost)

        # Genre centroid pull (20% when genre is matched)
        primary_genre_slug = (genres[0] if genres else (genre_list[0] if genre_list else "")).lower().replace(" ", "-")
        genre_pos = genre_positions.get(primary_genre_slug)
        genre_pull = 0.20 if genre_pos else 0.0

        pos = {
            "x": round(sem["x"] * (1 - genre_pull) + (genre_pos["x"] if genre_pos else 0) * genre_pull, 2),
            "y": round(sem["y"] * (1 - genre_pull) + (genre_pos["y"] if genre_pos else 0) * genre_pull + (popularity - 0.5) * 1.2, 2),
            "z": round(sem["z"] * (1 - genre_pull) + (genre_pos["z"] if genre_pos else 0) * genre_pull, 2),
        }

        if has_own:
            semantic_artist_count += 1

        role = "surge-star" if is_surge else ("ghost-star" if is_ghost else ("anchor-star" if popularity > 0.65 else "star"))
        node = {
            "id":           artist_id,
            "type":         "artist",
            "label":        name,
            "color":        color,
            "size":         round(0.22 + popularity * 0.62, 2),
            "position":     pos,
            "audioFeatures": features,
            "metrics": {
                "significance": float(popularity),
                "anchorScore":  float(popularity),
                "discoveryScore": float(discovery),
                "isSurge":       is_surge,
                "isGhost":       is_ghost,
            },
            "role":         role,
            "layoutBasis":  "semantic-audio-features" if has_own else "profile-average-fallback",
            "image":        artist.get("image"),
        }
        nodes.append(node)
        artist_node_map[artist_id] = node

        # Artist → genre edge
        if genre_pos:
            edges.append({
                "id":          f"e:artist-genre:{artist_id}:{primary_genre_slug}",
                "source":      artist_id,
                "target":      f"genre:{primary_genre_slug}",
                "type":        "genre_affinity",
                "weight":      float(popularity),
                "explanation": f"{name} is a key voice in {genres[0] if genres else 'this genre'}.",
            })

    # ── Track nodes (optional, limited) ──────────────────────────────────────
    for i, track in enumerate(raw_tracks[:20]):
        title     = track.get("title", "")
        artist    = track.get("artist", "")
        track_id  = track.get("id") or f"track:{title.lower().replace(' ', '-')}:{artist.lower().replace(' ', '-')}"
        artist_id = next(
            (a.get("id") or f"artist:{a['name'].lower().replace(' ', '-')}"
             for a in raw_artists if a.get("name") == artist),
            None,
        )
        af      = track.get("audio_features") or {}
        energy  = _clamp(af.get("energy",  audio.get("energy",  0.5)))
        valence = _clamp(af.get("valence", audio.get("valence", 0.5)))
        color   = _artist_color(title, [])

        # Place track semantically near its artist with a small deterministic offset
        artist_node = artist_node_map.get(artist_id) if artist_id else None
        if artist_node:
            ap = artist_node["position"]
            j  = _seeded_offset(f"track-orbit:{track_id}", 1.1)
            pos = {
                "x": round(ap["x"] + j["x"] * 2.2, 2),
                "y": round(ap["y"] + j["y"] * 1.0, 2),
                "z": round(ap["z"] + j["z"] * 2.2, 2),
            }
        else:
            # No artist anchor: use track's own audio features for positioning
            sem = _build_semantic_position(af or audio, f"track-solo:{track_id}", jitter_scale=1.2)
            pos = sem

        nodes.append({
            "id":        track_id,
            "type":      "track",
            "label":     title,
            "color":     color,
            "size":      round(0.14 + energy * 0.22, 2),
            "position":  pos,
            "audioFeatures": {"energy": energy, "valence": valence},
            "metrics":   {"significance": round((energy + valence) / 2, 3), "energy": energy, "valence": valence},
            "role":      "satellite",
            "artist":    artist,
        })
        if artist_node:
            edges.append({
                "id":          f"e:track-artist:{track_id}:{artist_id}",
                "source":      track_id,
                "target":      artist_id,
                "type":        "song_orbit",
                "weight":      0.6,
                "explanation": f"{title} orbits {artist}.",
            })

    # ── Bridge edges — weight derived from audio feature similarity ───────────
    # Two significant artists get a bridge_lane if their audio features are
    # close enough; the weight encodes semantic closeness, not random noise.
    significant_artists = [n for n in nodes if n["type"] == "artist" and n["metrics"]["significance"] > 0.55]
    for i, na in enumerate(significant_artists[:12]):
        for nb in significant_artists[i + 1:i + 4]:
            af_a = na.get("audioFeatures") or {}
            af_b = nb.get("audioFeatures") or {}
            # Semantic similarity: 1 − normalised euclidean distance in [v,e,organic]
            v_diff = abs(_clamp(af_a.get("valence",      0.5)) - _clamp(af_b.get("valence",      0.5)))
            e_diff = abs(_clamp(af_a.get("energy",       0.5)) - _clamp(af_b.get("energy",       0.5)))
            o_a    = _clamp(af_a.get("acousticness", 0.5)) * 0.6 + (1 - _clamp(af_a.get("danceability", 0.5))) * 0.4
            o_b    = _clamp(af_b.get("acousticness", 0.5)) * 0.6 + (1 - _clamp(af_b.get("danceability", 0.5))) * 0.4
            dist   = (v_diff ** 2 + e_diff ** 2 + (o_a - o_b) ** 2) ** 0.5
            sim    = round(max(0.0, 1.0 - dist / 1.732), 3)   # 1.732 ≈ √3 = max distance
            weight = round(0.45 + sim * 0.45, 3)
            edges.append({
                "id":          f"e:bridge:{na['id']}:{nb['id']}",
                "source":      na["id"],
                "target":      nb["id"],
                "type":        "bridge_lane",
                "weight":      weight,
                "explanation": (
                    f"Audio similarity {round(sim * 100)}%: both lean toward similar "
                    f"{'brightness' if v_diff < 0.15 else 'energy' if e_diff < 0.15 else 'texture'}."
                ),
            })

    # ── Regions ───────────────────────────────────────────────────────────────
    regions: list[dict] = []
    for i, genre in enumerate(genre_list[:6]):
        slug  = genre.lower().replace(" ", "-")
        gpos  = genre_positions.get(slug, {"x": 0, "y": 0, "z": 0})
        artist_ids = [
            n["id"] for n in nodes
            if n["type"] == "artist"
            and any(
                (a.get("genres") or []) and a["genres"][0].lower().replace(" ", "-") == slug
                for a in raw_artists
                if (a.get("id") or f"artist:{a['name'].lower().replace(' ', '-')}") == n["id"]
            )
        ][:5]
        coverage = min(1.0, (len(artist_ids) / 8.0))
        regions.append({
            "id":               f"region:{slug}",
            "label":            genre,
            "title":            genre.title(),
            "color":            _genre_color(genre),
            "centroid":         gpos,
            "coverage":         float(coverage),
            "anchorArtistIds":  artist_ids,
            "explanation":      f"A region shaped by {genre} energy.",
        })

    # ── Metadata ──────────────────────────────────────────────────────────────
    artist_nodes = [n for n in nodes if n["type"] == "artist"]
    anchors      = sorted(artist_nodes, key=lambda n: n["metrics"]["significance"], reverse=True)[:5]
    core_pos     = (
        {
            "x": round(sum(a["position"]["x"] for a in anchors) / len(anchors), 2),
            "y": round(sum(a["position"]["y"] for a in anchors) / len(anchors), 2),
            "z": round(sum(a["position"]["z"] for a in anchors) / len(anchors), 2),
        }
        if anchors else {"x": 0.0, "y": 0.0, "z": 0.0}
    )
    confidence = round(min(1.0, (len(artist_nodes) / 30.0 * 0.7) + (len(genre_list) / 8.0 * 0.3)), 3)

    # Measure semantic coverage: how many artists had their own audio features
    semantic_count = sum(1 for n in artist_nodes if n.get("layoutBasis") == "semantic-audio-features")
    semantic_coverage = round(semantic_count / max(len(artist_nodes), 1), 3)

    metadata: dict[str, Any] = {
        "generated_at":       None,
        "layout":             LAYOUT_VERSION,
        "layout_method":      LAYOUT_METHOD,
        "coordinate_meaning": COORDINATE_MEANING,
        "similarity_basis":   SIMILARITY_BASIS,
        "semantic_coverage":  semantic_coverage,
        "meaning": {
            "dominantGenre":     genre_list[0] if genre_list else "unknown",
            "artistCount":       len(artist_nodes),
            "trackCount":        len([n for n in nodes if n["type"] == "track"]),
            "regionCount":       len(regions),
            "semanticArtists":   semantic_count,
        },
        "core": {
            "label":             "Taste Core",
            "position":          core_pos,
            "color":             anchors[0]["color"] if anchors else "#8B7CFF",
            "supportingArtists": [a["id"] for a in anchors],
            "strength":          round(
                sum(a["metrics"]["significance"] for a in anchors) / max(len(anchors), 1), 3
            ),
        },
    }

    logger.info({
        "event":             "galaxy_artifact_built",
        "nodes":             len(nodes),
        "edges":             len(edges),
        "regions":           len(regions),
        "semantic_coverage": semantic_coverage,
        "layout_method":     LAYOUT_METHOD,
        "key":               idempotency_key,
    })

    return {
        "nodes":            nodes,
        "edges":            edges,
        "regions":          regions,
        "clusters":         [],
        "metadata":         metadata,
        "pipeline_version": LAYOUT_VERSION,
        "confidence":       float(confidence),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@galaxy_bp.route("/api/galaxy/build", methods=["POST"])
@optional_auth
def build_galaxy():
    """
    Build and return a galaxy artifact synchronously.

    Also runs Last.fm/non-Spotify artist feature enrichment when the
    profile's topArtists lack audio features — improving semantic coverage
    without blocking the response.
    """
    data            = request.get_json(silent=True) or {}
    profile_payload = data.get("profile") or {}
    idempotency_key = (data.get("idempotency_key") or "").strip()

    if not profile_payload:
        return api_error("profile payload required", 400, code="PROFILE_REQUIRED")

    # ── Enrich artist features for Last.fm / sparse profiles ─────────────
    from utils.provider_cookies import spotify_context_from_request
    spotify_token, _, _ = spotify_context_from_request(request)

    try:
        from services.artist_feature_cache import enrich_artist_features
        enriched_artists, semantic_coverage = enrich_artist_features(
            profile_payload.get("topArtists") or [],
            spotify_token=spotify_token,
        )
        if enriched_artists:
            profile_payload = {**profile_payload, "topArtists": enriched_artists}
        logger.info({"event": "galaxy_feature_enrichment", "semantic_coverage": semantic_coverage})
    except Exception as exc:
        logger.warning({"event": "galaxy_feature_enrichment_failed", "error": str(exc)})

    try:
        artifact = _build_galaxy_artifact(profile_payload, idempotency_key)
        return api_success(artifact)
    except Exception as exc:
        logger.error({"event": "galaxy_build_failed", "error": str(exc)})
        return api_error("Galaxy build failed", 500, code="GALAXY_BUILD_FAILED")


@galaxy_bp.route("/api/galaxy/jobs", methods=["POST"])
@optional_auth
def enqueue_galaxy_build():
    """
    Enqueue a background galaxy build.  Useful for larger profiles where
    the client wants an immediate response and polls later.
    """
    data = request.get_json(silent=True) or {}
    profile_payload = data.get("profile") or {}
    idempotency_key = (data.get("idempotency_key") or "").strip()

    if not profile_payload:
        return api_error("profile payload required", 400, code="PROFILE_REQUIRED")

    # Freeze a copy for the background worker
    frozen_profile  = dict(profile_payload)
    frozen_key      = idempotency_key

    def _build():
        return _build_galaxy_artifact(frozen_profile, frozen_key)

    dedupe_key = f"galaxy-{idempotency_key}" if idempotency_key else "galaxy-build"
    job = job_registry.submit(dedupe_key, _build, dedupe_key=dedupe_key)
    return api_success({"job_id": job["id"], "status": job["status"]}, status=202)

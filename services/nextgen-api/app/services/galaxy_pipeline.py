from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from datetime import datetime, timezone

from app.core.settings import get_settings
from app.models.galaxy import (
    GalaxyArtifactPayload,
    GalaxyCluster,
    GalaxyEdge,
    GalaxyNode,
    GalaxyProfileRequest,
    GalaxyRegion,
    Vector3,
)


def _clamp(value: float | None, minimum: float = 0.0, maximum: float = 1.0) -> float:
    if value is None or math.isnan(value):
        return 0.0
    return max(minimum, min(maximum, float(value)))


def _tempo_norm(value: float | None) -> float:
    if value is None:
        return 0.5
    return _clamp((float(value) - 60.0) / 140.0)


def _stable_hash(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:12], 16)


def _artifact_id(profile: GalaxyProfileRequest) -> str:
    digest = hashlib.sha256(
        f"{profile.user_id}:{profile.source_window}:{len(profile.topArtists)}:{len(profile.topTracks)}".encode("utf-8")
    ).hexdigest()
    return digest[:24]


def _palette(index: int) -> str:
    colors = ["#8B7CFF", "#B994FF", "#A6B8FF", "#F1A9DF", "#9FD0FF", "#D6D0F0"]
    return colors[index % len(colors)]


def _region_label(energy: float, valence: float) -> str:
    if energy >= 0.65 and valence >= 0.55:
        return "luminous"
    if energy >= 0.65:
        return "electric"
    if valence >= 0.58:
        return "romantic"
    if energy <= 0.35 and valence <= 0.4:
        return "nocturnal"
    return "dreamy"


def _vector_from_artist(artist, fallback) -> list[float]:
    af = artist.audio_features or fallback
    return [
        _clamp(af.energy if af else None),
        _clamp(af.valence if af else None),
        _clamp(af.danceability if af else None),
        _clamp(af.acousticness if af else None),
        _tempo_norm(af.tempo if af else None),
        _clamp((artist.popularity or 50) / 100),
    ]


def _distance(left: list[float], right: list[float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def _mean(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return [0.5] * 6
    dims = len(vectors[0])
    return [sum(vector[index] for vector in vectors) / len(vectors) for index in range(dims)]


def _kmeans(vectors: list[list[float]], cluster_count: int) -> tuple[list[int], list[list[float]]]:
    centroids = [vectors[index % len(vectors)] for index in range(cluster_count)]
    assignments = [0] * len(vectors)

    for _ in range(8):
        for index, vector in enumerate(vectors):
            assignments[index] = min(range(cluster_count), key=lambda cluster: _distance(vector, centroids[cluster]))
        for cluster in range(cluster_count):
            members = [vector for index, vector in enumerate(vectors) if assignments[index] == cluster]
            if members:
                centroids[cluster] = _mean(members)

    return assignments, centroids


def _force_layout(seed_positions: list[tuple[float, float, float]], groups: list[int]) -> list[tuple[float, float, float]]:
    positions = [list(position) for position in seed_positions]
    for _ in range(50):
        for index, current in enumerate(positions):
            repulsion_x = repulsion_y = repulsion_z = 0.0
            for other_index, other in enumerate(positions):
                if index == other_index:
                    continue
                dx = current[0] - other[0]
                dy = current[1] - other[1]
                dz = current[2] - other[2]
                dist_sq = max((dx * dx) + (dy * dy) + (dz * dz), 0.08)
                force = 0.012 / dist_sq
                repulsion_x += dx * force
                repulsion_y += dy * force
                repulsion_z += dz * force

            cohesion = 0.028
            cluster_bias = groups[index] * 0.6
            current[0] += repulsion_x - (current[0] - cluster_bias) * cohesion
            current[1] += repulsion_y - current[1] * cohesion * 0.85
            current[2] += repulsion_z - current[2] * cohesion

    return [tuple(position) for position in positions]


def build_galaxy_artifact(profile: GalaxyProfileRequest) -> GalaxyArtifactPayload:
    settings = get_settings()
    artists = profile.topArtists[:32]
    tracks = profile.topTracks[:20]
    fallback_features = profile.audioFeatures
    vectors = [_vector_from_artist(artist, fallback_features) for artist in artists]

    if not artists:
      return GalaxyArtifactPayload(
          artifact_id=_artifact_id(profile),
          pipeline_version=settings.pipeline_version,
          embedding_version=settings.embedding_version,
          feature_schema_version=settings.feature_schema_version,
          source_window=profile.source_window,
          node_count=0,
          edge_count=0,
          cluster_count=0,
          confidence=0.0,
          nodes=[],
          edges=[],
          clusters=[],
          regions=[],
          metadata={"generated_at": datetime.now(timezone.utc).isoformat(), "empty": True},
      )

    cluster_count = max(3, min(6, round(math.sqrt(len(artists) / 2))))
    assignments, centroids = _kmeans(vectors, cluster_count)
    seed_positions = []
    for index, vector in enumerate(vectors):
        novelty = 1 - vector[5]
        angle = (index / max(len(vectors), 1)) * math.pi * 2
        radius = 5.2 + novelty * 4.4
        seed_positions.append((
            math.cos(angle) * radius + (assignments[index] - cluster_count / 2) * 0.9,
            (vector[0] - 0.5) * 6.0,
            math.sin(angle) * radius + (vector[1] - 0.5) * 4.0,
        ))

    laid_out = _force_layout(seed_positions, assignments)
    cluster_members: dict[int, list[int]] = defaultdict(list)
    for index, assignment in enumerate(assignments):
        cluster_members[assignment].append(index)

    clusters: list[GalaxyCluster] = []
    nodes: list[GalaxyNode] = []
    edges: list[GalaxyEdge] = []
    regions_by_label: dict[str, list[str]] = defaultdict(list)

    for cluster_index in range(cluster_count):
        members = cluster_members.get(cluster_index, [])
        if not members:
            continue
        cluster_artists = [artists[index] for index in members]
        member_vectors = [vectors[index] for index in members]
        dominant_genres = []
        for artist in cluster_artists:
            for genre in artist.genres[:2]:
                if genre not in dominant_genres:
                    dominant_genres.append(genre)
        centroid_position = (
            sum(laid_out[index][0] for index in members) / len(members),
            sum(laid_out[index][1] for index in members) / len(members),
            sum(laid_out[index][2] for index in members) / len(members),
        )
        clusters.append(
            GalaxyCluster(
                id=f"cluster-{cluster_index}",
                label=dominant_genres[0] if dominant_genres else f"Signal Cluster {cluster_index + 1}",
                centroid=Vector3(x=centroid_position[0], y=centroid_position[1], z=centroid_position[2]),
                color=_palette(cluster_index),
                members=[f"artist:{artists[index].id or _stable_hash(artists[index].name)}" for index in members],
                dominant_genres=dominant_genres[:4],
                confidence=round(0.62 + min(0.28, len(members) / max(len(artists), 1)), 3),
                explanation=f"{len(members)} artists cluster here because their energy, valence, danceability, texture, and popularity vectors converge.",
            )
        )

        for artist_index in members:
            artist = artists[artist_index]
            vector = member_vectors[members.index(artist_index)]
            region_label = _region_label(vector[0], vector[1])
            node_id = f"artist:{artist.id or _stable_hash(artist.name)}"
            regions_by_label[region_label].append(node_id)
            nodes.append(
                GalaxyNode(
                    id=node_id,
                    type="artist",
                    label=artist.name,
                    position=Vector3(x=laid_out[artist_index][0], y=laid_out[artist_index][1], z=laid_out[artist_index][2]),
                    size=round(0.42 + vector[5] * 0.9, 3),
                    color=_palette(cluster_index),
                    cluster_id=f"cluster-{cluster_index}",
                    region_label=region_label,
                    image=artist.image,
                    metrics={
                        "significance": round(vector[5], 3),
                        "energy": round(vector[0], 3),
                        "valence": round(vector[1], 3),
                        "danceability": round(vector[2], 3),
                        "acousticness": round(vector[3], 3),
                        "novelty": round(1 - vector[5], 3),
                    },
                    explanation="Artist star positioned by a deterministic taste vector and separated through force layout to prevent overlap inside its cluster.",
                )
            )
            edges.append(
                GalaxyEdge(
                    id=f"{node_id}--cluster-{cluster_index}",
                    source=node_id,
                    target=f"cluster-{cluster_index}",
                    type="artist_cluster",
                    weight=round(0.65 + vector[5] * 0.25, 3),
                    confidence=0.82,
                    explanation="This edge encodes cluster membership strength from the artist feature vector to its cluster centroid.",
                )
            )

    for left in range(len(clusters)):
        for right in range(left + 1, len(clusters)):
            left_vector = centroids[left]
            right_vector = centroids[right]
            dist = _distance(left_vector, right_vector)
            if dist > 0.58:
                continue
            edges.append(
                GalaxyEdge(
                    id=f"{clusters[left].id}--{clusters[right].id}",
                    source=clusters[left].id,
                    target=clusters[right].id,
                    type="cluster_bridge",
                    weight=round(1 - dist, 3),
                    confidence=0.76,
                    explanation="Cluster bridge strength is the inverse distance between two centroid vectors, revealing neighboring taste territories.",
                )
            )

    artist_lookup = {node.label.lower(): node for node in nodes}
    for index, track in enumerate(tracks):
        anchor = artist_lookup.get(track.artist.lower())
        if not anchor:
            continue
        vector = _vector_from_artist(track, fallback_features)
        orbit = 0.85 + (index % 5) * 0.18
        angle = (index / max(len(tracks), 1)) * math.pi * 2
        track_id = f"track:{track.id or _stable_hash(track.title + track.artist)}"
        nodes.append(
            GalaxyNode(
                id=track_id,
                type="track",
                label=track.title,
                position=Vector3(
                    x=anchor.position.x + math.cos(angle) * orbit,
                    y=anchor.position.y + (vector[0] - 0.5) * 0.7,
                    z=anchor.position.z + math.sin(angle) * orbit,
                ),
                size=round(0.18 + vector[5] * 0.22, 3),
                color=anchor.color,
                cluster_id=anchor.cluster_id,
                region_label=anchor.region_label,
                image=track.album_art,
                metrics={
                    "anchorScore": round(vector[5], 3),
                    "tempo": round(_tempo_norm(track.audio_features.tempo if track.audio_features else None), 3),
                },
                explanation="Track satellites orbit their anchor artist so song-level detail expands the cluster without turning the scene into visual noise.",
            )
        )
        edges.append(
            GalaxyEdge(
                id=f"{track_id}--{anchor.id}",
                source=track_id,
                target=anchor.id,
                type="track_anchor",
                weight=round(0.52 + vector[5] * 0.24, 3),
                confidence=0.72,
                explanation="Track-to-artist edge expresses how strongly the song reinforces the local artist anchor.",
            )
        )

    regions: list[GalaxyRegion] = []
    for index, (label, member_ids) in enumerate(regions_by_label.items()):
        member_nodes = [node for node in nodes if node.id in member_ids]
        if not member_nodes:
            continue
        regions.append(
            GalaxyRegion(
                id=f"region-{label}",
                label=label,
                title=label.title(),
                centroid=Vector3(
                    x=sum(node.position.x for node in member_nodes) / len(member_nodes),
                    y=sum(node.position.y for node in member_nodes) / len(member_nodes),
                    z=sum(node.position.z for node in member_nodes) / len(member_nodes),
                ),
                color=_palette(index),
                coverage=round(len(member_nodes) / max(len(artists), 1), 3),
                members=member_ids,
                explanation="Mood regions aggregate nearby artists with similar energy and valence so distance carries emotional meaning, not decoration.",
            )
        )

    confidence = round(min(0.94, 0.54 + (len(artists) / 40) + (len(tracks) / 120)), 3)
    artifact_id = _artifact_id(profile)
    return GalaxyArtifactPayload(
        artifact_id=artifact_id,
        pipeline_version=settings.pipeline_version,
        embedding_version=settings.embedding_version,
        feature_schema_version=settings.feature_schema_version,
        source_window=profile.source_window,
        node_count=len(nodes),
        edge_count=len(edges),
        cluster_count=len(clusters),
        confidence=confidence,
        nodes=nodes,
        edges=edges,
        clusters=clusters,
        regions=regions,
        metadata={
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "provider_mix": ["spotify"],
            "layout": "deterministic-kmeans-force-v1",
            "meaning": {
                "size": "significance and popularity weight",
                "color": "cluster membership",
                "distance": "feature-space similarity after force relaxation",
            },
        },
    )

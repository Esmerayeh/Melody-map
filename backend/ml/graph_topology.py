from __future__ import annotations

import math

import networkx as nx

from ml.representation_learning import embed_tokens


GRAPH_EMBEDDING_VERSION = "2026-04-graph-topology-v1"


def _tokenize_node(node: dict) -> list[str]:
    tokens = []
    for key in ("label", "name", "genre", "type"):
        value = node.get(key)
        if value:
            tokens.extend(str(value).lower().replace("/", " ").split())
    return [token for token in tokens if token]


def build_galaxy_topology(nodes: list[dict]) -> dict:
    graph = nx.Graph()
    for index, node in enumerate(nodes):
        node_id = str(node.get("id") or f"node-{index}")
        graph.add_node(node_id, **node)

    artists = [node for node in nodes if node.get("type") == "artist"]
    genres = [node for node in nodes if node.get("type") == "genre"]

    for artist in artists:
        artist_id = str(artist.get("id"))
        primary_genre = str(artist.get("genre") or "")
        if primary_genre:
            for genre in genres:
                if str(genre.get("label") or genre.get("name") or "").lower() == primary_genre.lower():
                    graph.add_edge(artist_id, str(genre.get("id")), weight=0.88)
                    break

    for idx, artist in enumerate(artists):
        for other in artists[idx + 1:]:
            if str(artist.get("genre") or "").lower() == str(other.get("genre") or "").lower() and artist.get("genre"):
                graph.add_edge(str(artist.get("id")), str(other.get("id")), weight=0.42)

    # greedy_modularity_communities computes q0 = 1/m where m is the EDGE count,
    # so it raises ZeroDivisionError on a graph that has nodes but no edges (e.g.
    # top artists with no genre links to connect them). Guard on edges, not nodes:
    # with no edges there are no communities to detect — every node defaults to 0.
    communities = (
        list(nx.algorithms.community.greedy_modularity_communities(graph))
        if graph.number_of_edges() else []
    )
    community_lookup: dict[str, int] = {}
    for community_id, community in enumerate(communities):
        for node_id in community:
            community_lookup[str(node_id)] = community_id

    centrality = nx.degree_centrality(graph) if graph.number_of_nodes() else {}
    graph_vectors = {
        str(node_id): embed_tokens(
            _tokenize_node(graph.nodes[node_id]) + [f"community:{community_lookup.get(str(node_id), 0)}", f"degree:{int(math.floor((centrality.get(node_id, 0.0) * 10)))}"],
            salt="graph-node",
        )
        for node_id in graph.nodes
    }

    return {
        "graphEmbeddingVersion": GRAPH_EMBEDDING_VERSION,
        "communityCount": len(communities),
        "communities": {node_id: community_lookup.get(str(node_id), 0) for node_id in graph.nodes},
        "centrality": {str(node_id): round(float(score), 6) for node_id, score in centrality.items()},
        "nodeVectors": graph_vectors,
        "edgeCount": graph.number_of_edges(),
    }

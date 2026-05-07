from __future__ import annotations

import random
from collections import Counter, defaultdict

import networkx as nx
import numpy as np
from sklearn.decomposition import TruncatedSVD


GRAPH_EMBEDDING_VERSION = "2026-04-graph-walk-v1"


def _build_graph(topology: dict) -> nx.Graph:
    graph = nx.Graph()
    for node in topology.get("nodes", []) or []:
        graph.add_node(node.get("id"), label=node.get("label"), type=node.get("type"))
    for edge in topology.get("links", []) or []:
        source = edge.get("source")
        target = edge.get("target")
        if source and target and source != target:
            graph.add_edge(source, target, weight=edge.get("strength", 1.0))
    return graph


def _random_walk(graph: nx.Graph, start: str, length: int = 6) -> list[str]:
    walk = [start]
    current = start
    for _ in range(max(0, length - 1)):
        neighbors = list(graph.neighbors(current))
        if not neighbors:
            break
        current = random.choice(neighbors)
        walk.append(current)
    return walk


def build_graph_walk_embeddings(topology: dict, dimensions: int = 12, walks_per_node: int = 6, walk_length: int = 6) -> dict:
    graph = _build_graph(topology or {})
    nodes = list(graph.nodes())
    if len(nodes) < 2:
        return {
            "version": GRAPH_EMBEDDING_VERSION,
            "dimensions": 0,
            "communities": [],
            "nodeVectors": {},
            "edgeDensity": 0.0,
        }

    random.seed(42)
    cooccurrence: dict[str, Counter] = defaultdict(Counter)
    for node in nodes:
        for _ in range(max(1, walks_per_node)):
            walk = _random_walk(graph, node, length=walk_length)
            unique = list(dict.fromkeys(walk))
            for source in unique:
                for target in unique:
                    if source != target:
                        cooccurrence[source][target] += 1

    index = {node: idx for idx, node in enumerate(nodes)}
    matrix = np.zeros((len(nodes), len(nodes)), dtype="float32")
    for source, targets in cooccurrence.items():
        for target, count in targets.items():
            matrix[index[source], index[target]] = float(count)

    width = min(max(2, dimensions), max(2, min(matrix.shape) - 1))
    if width >= min(matrix.shape):
        width = max(1, min(matrix.shape) - 1)
    if width <= 0:
        width = 1

    svd = TruncatedSVD(n_components=width, random_state=42)
    vectors = svd.fit_transform(matrix)

    communities = []
    for community_id, cluster in enumerate(nx.community.greedy_modularity_communities(graph), start=1):
        communities.append({"id": f"walk-community-{community_id}", "members": sorted(cluster)})

    def _normalize(vector: np.ndarray) -> list[float]:
        norm = np.linalg.norm(vector)
        dense = vector if norm == 0 else vector / norm
        return [round(float(value), 6) for value in dense.tolist()]

    node_vectors = {node: _normalize(vectors[index[node]]) for node in nodes}
    possible_edges = max((len(nodes) * (len(nodes) - 1)) / 2.0, 1.0)
    density = round(graph.number_of_edges() / possible_edges, 4)

    return {
        "version": GRAPH_EMBEDDING_VERSION,
        "dimensions": width,
        "communities": communities,
        "nodeVectors": node_vectors,
        "edgeDensity": density,
    }


def project_node_vectors(node_vectors: dict[str, list[float]]) -> dict[str, dict]:
    keys = list(node_vectors.keys())
    if not keys:
        return {}
    matrix = np.asarray([node_vectors[key] for key in keys], dtype=float)
    width = min(2, matrix.shape[1]) if len(matrix.shape) > 1 and matrix.shape[1] else 1
    if width == 1:
        coords = np.column_stack([matrix[:, 0], np.zeros(len(keys))])
    else:
        svd = TruncatedSVD(n_components=2, random_state=42)
        coords = svd.fit_transform(matrix)
    return {
        key: {"x": round(float(coords[idx][0]), 6), "y": round(float(coords[idx][1]), 6), "z": 0.0}
        for idx, key in enumerate(keys)
    }

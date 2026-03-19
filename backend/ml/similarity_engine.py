"""
Music Similarity Engine
-----------------------
Handles feature extraction, normalisation, clustering, and dimensionality
reduction for the Music Galaxy visualisation.

Supports both 2-D (D3) and 3-D (Three.js / R3F) coordinate output.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import networkx as nx

FEATURE_COLUMNS = [
    'tempo', 'energy', 'danceability', 'valence',
    'acousticness', 'instrumentalness', 'loudness', 'speechiness',
]


class MusicSimilarityEngine:
    def __init__(self, n_clusters: int = 10):
        self.n_clusters = n_clusters
        self.scaler     = StandardScaler()
        self.kmeans: KMeans | None = None
        self.pca:   PCA    | None = None

    # ------------------------------------------------------------------
    # Feature extraction
    # ------------------------------------------------------------------
    def extract_features(self, songs_data: list) -> np.ndarray:
        """Return (N, F) feature matrix from a list of song dicts."""
        rows = []
        for song in songs_data:
            af = song.get('audio_features') or {}
            row = []
            for col in FEATURE_COLUMNS:
                v = float(af.get(col, 0) or 0)
                if col == 'loudness':
                    v = max(0.0, min(1.0, (v + 60) / 60))
                elif col == 'tempo':
                    v = min(v / 200.0, 1.0)
                row.append(v)
            rows.append(row)
        return np.array(rows, dtype=np.float32)

    def normalize_features(self, features: np.ndarray) -> np.ndarray:
        return self.scaler.fit_transform(features)

    # ------------------------------------------------------------------
    # Similarity
    # ------------------------------------------------------------------
    def compute_similarity(self, features: np.ndarray) -> np.ndarray:
        return cosine_similarity(features)

    def find_similar_songs(self, song_features: np.ndarray, all_features: np.ndarray,
                           top_k: int = 10) -> tuple[np.ndarray, np.ndarray]:
        sims = cosine_similarity([song_features], all_features)[0]
        indices = np.argsort(sims)[::-1][1:top_k + 1]
        return indices, sims[indices]

    # ------------------------------------------------------------------
    # Clustering
    # ------------------------------------------------------------------
    def cluster_songs(self, features: np.ndarray) -> np.ndarray:
        k = min(self.n_clusters, len(features))
        self.kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        return self.kmeans.fit_predict(features)

    def get_cluster_characteristics(self, features: np.ndarray, clusters: np.ndarray) -> dict:
        df = pd.DataFrame(features, columns=FEATURE_COLUMNS)
        df['cluster'] = clusters
        return df.groupby('cluster').mean().to_dict('index')

    # ------------------------------------------------------------------
    # Dimensionality reduction — 2-D
    # ------------------------------------------------------------------
    def reduce_dimensions_pca(self, features: np.ndarray, n_components: int = 2) -> np.ndarray:
        n_components = min(n_components, features.shape[1], features.shape[0])
        self.pca = PCA(n_components=n_components, random_state=42)
        return self.pca.fit_transform(features)

    # ------------------------------------------------------------------
    # Dimensionality reduction — 3-D (for Music Galaxy)
    # ------------------------------------------------------------------
    def reduce_dimensions_3d(self, features: np.ndarray) -> np.ndarray:
        """
        Returns (N, 3) array of coordinates suitable for Three.js.
        Uses PCA to 3 components then scales to a unit sphere of radius ~10.
        """
        n_components = min(3, features.shape[1], features.shape[0])
        pca3 = PCA(n_components=n_components, random_state=42)
        coords = pca3.fit_transform(features).astype(np.float32)

        # Pad to 3 columns if fewer components were available
        if coords.shape[1] < 3:
            pad = np.zeros((coords.shape[0], 3 - coords.shape[1]), dtype=np.float32)
            coords = np.hstack([coords, pad])

        # Normalise to sphere of radius 10
        norms = np.linalg.norm(coords, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        coords = coords / norms * 10.0
        return coords

    # ------------------------------------------------------------------
    # Graph
    # ------------------------------------------------------------------
    def build_music_graph(self, songs_data: list, similarity_matrix: np.ndarray,
                          threshold: float = 0.7) -> nx.Graph:
        G = nx.Graph()
        for i, song in enumerate(songs_data):
            G.add_node(i, **{k: str(v) for k, v in song.items()})
        n = len(songs_data)
        for i in range(n):
            for j in range(i + 1, n):
                if similarity_matrix[i][j] > threshold:
                    G.add_edge(i, j, weight=float(similarity_matrix[i][j]))
        return G

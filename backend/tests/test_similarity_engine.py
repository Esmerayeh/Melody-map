"""Unit tests for the MusicSimilarityEngine."""
import pytest
import numpy as np
from ml.similarity_engine import MusicSimilarityEngine

def make_song(sid, energy=0.5, valence=0.5):
    return {'_id': sid, 'audio_features': {
        'energy': energy, 'valence': valence, 'danceability': 0.5,
        'acousticness': 0.3, 'instrumentalness': 0.0,
        'loudness': -10.0, 'speechiness': 0.05, 'tempo': 120.0,
    }}

SONGS = [make_song(f's{i}', energy=i*0.1, valence=i*0.1) for i in range(1, 11)]

def test_extract_features_shape():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    assert feats.shape == (10, 8)

def test_normalize_features():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    norm   = engine.normalize_features(feats)
    assert norm.shape == feats.shape
    # After StandardScaler, mean should be ~0
    assert abs(norm.mean()) < 0.5

def test_cluster_songs():
    engine   = MusicSimilarityEngine(n_clusters=3)
    feats    = engine.extract_features(SONGS)
    norm     = engine.normalize_features(feats)
    clusters = engine.cluster_songs(norm)
    assert len(clusters) == len(SONGS)
    assert set(clusters).issubset({0, 1, 2})

def test_reduce_dimensions_pca_2d():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    norm   = engine.normalize_features(feats)
    coords = engine.reduce_dimensions_pca(norm, 2)
    assert coords.shape == (10, 2)

def test_reduce_dimensions_3d():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    norm   = engine.normalize_features(feats)
    coords = engine.reduce_dimensions_3d(norm)
    assert coords.shape == (10, 3)
    # All points should be on a sphere of radius ~10
    radii = np.linalg.norm(coords, axis=1)
    assert all(abs(r - 10.0) < 0.01 for r in radii)

def test_find_similar_songs():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    norm   = engine.normalize_features(feats)
    idx, scores = engine.find_similar_songs(norm[0], norm, top_k=3)
    assert len(idx) == 3
    assert all(0 <= s <= 1 for s in scores)

def test_compute_similarity_shape():
    engine = MusicSimilarityEngine()
    feats  = engine.extract_features(SONGS)
    sim    = engine.compute_similarity(feats)
    assert sim.shape == (10, 10)
    assert all(sim[i][i] == pytest.approx(1.0) for i in range(10))

"""Unit tests for the RecommendationEngine."""
import pytest
import numpy as np
from ml.recommendation_engine import RecommendationEngine, _song_vector, _normalise_loudness

# ── Fixtures ───────────────────────────────────────────────────────────────────
def make_song(sid, energy=0.5, valence=0.5, danceability=0.5,
              acousticness=0.3, tempo=120.0, loudness=-10.0):
    return {
        '_id': sid,
        'audio_features': {
            'energy': energy, 'valence': valence, 'danceability': danceability,
            'acousticness': acousticness, 'instrumentalness': 0.0,
            'loudness': loudness, 'speechiness': 0.05, 'tempo': tempo,
        }
    }

SONGS = [
    make_song('s1', energy=0.9, valence=0.8, danceability=0.85),   # happy/party
    make_song('s2', energy=0.1, valence=0.2, danceability=0.2),    # sad/calm
    make_song('s3', energy=0.5, valence=0.5, danceability=0.5),    # neutral
    make_song('s4', energy=0.8, valence=0.7, danceability=0.75),   # energetic
    make_song('s5', energy=0.2, valence=0.3, acousticness=0.8),    # calm/dreamy
]

# ── Helper tests ───────────────────────────────────────────────────────────────
def test_normalise_loudness():
    assert _normalise_loudness(0.0)   == 1.0
    assert _normalise_loudness(-60.0) == 0.0
    assert _normalise_loudness(-30.0) == pytest.approx(0.5)

def test_song_vector_shape():
    vec = _song_vector(SONGS[0])
    assert vec.shape == (8,)
    assert all(0.0 <= v <= 1.0 for v in vec), "All values should be normalised to [0,1]"

# ── Engine tests ───────────────────────────────────────────────────────────────
def test_build_user_profile_empty():
    engine = RecommendationEngine()
    assert engine.build_user_profile([], SONGS) is None

def test_build_user_profile():
    engine = RecommendationEngine()
    interactions = [{'user_id': 'u1', 'song_id': 's1', 'interaction_type': 'like'}]
    profile = engine.build_user_profile(interactions, SONGS)
    assert profile is not None
    assert 'energy' in profile
    assert profile['energy'] == pytest.approx(0.9)

def test_content_based_filtering_returns_list():
    engine  = RecommendationEngine()
    profile = {'energy': 0.9, 'valence': 0.8, 'danceability': 0.85,
               'acousticness': 0.3, 'instrumentalness': 0.0,
               'loudness': -10.0, 'speechiness': 0.05, 'tempo': 120.0}
    recs = engine.content_based_filtering(profile, SONGS, top_k=3)
    assert len(recs) <= 3
    assert all('score' in r for r in recs)
    # Scores should be descending
    scores = [r['score'] for r in recs]
    assert scores == sorted(scores, reverse=True)

def test_content_based_filtering_no_profile():
    engine = RecommendationEngine()
    assert engine.content_based_filtering(None, SONGS) == []

def test_knn_similar():
    engine = RecommendationEngine()
    engine.fit_knn(SONGS, n_neighbors=3)
    results = engine.knn_similar(SONGS[0], top_k=2)
    assert len(results) <= 2
    assert all('score' in r for r in results)

def test_mood_playlist_happy():
    engine = RecommendationEngine()
    pl = engine.generate_mood_playlist('happy', SONGS, playlist_size=10)
    # All returned songs should satisfy happy criteria
    for song in pl:
        af = song['audio_features']
        assert af['valence'] >= 0.6
        assert af['energy']  >= 0.5

def test_mood_playlist_unknown_mood():
    engine = RecommendationEngine()
    assert engine.generate_mood_playlist('unknown_mood', SONGS) == []

def test_hybrid_recommendation_no_interactions():
    engine = RecommendationEngine()
    recs = engine.hybrid_recommendation('u1', None, [], SONGS, top_k=5)
    assert isinstance(recs, list)

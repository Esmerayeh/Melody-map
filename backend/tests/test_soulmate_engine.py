"""Unit tests for the SoulmateEngine."""
import pytest
from ml.soulmate_engine import SoulmateEngine, _jaccard, _normalise_names

# ── Helper tests ───────────────────────────────────────────────────────────────

def test_jaccard_identical():
    assert _jaccard({'a', 'b', 'c'}, {'a', 'b', 'c'}) == pytest.approx(1.0)

def test_jaccard_disjoint():
    assert _jaccard({'a', 'b'}, {'c', 'd'}) == pytest.approx(0.0)

def test_jaccard_partial():
    result = _jaccard({'a', 'b', 'c'}, {'b', 'c', 'd'})
    assert result == pytest.approx(2 / 4)

def test_jaccard_empty():
    assert _jaccard(set(), set()) == 0.0

def test_normalise_names():
    result = _normalise_names(['  Radiohead ', 'The Beatles', ''])
    assert 'radiohead' in result
    assert 'the beatles' in result
    assert '' not in result

# ── Engine tests ───────────────────────────────────────────────────────────────

PROFILE_A = {
    'artists': ['Radiohead', 'My Bloody Valentine', 'Cocteau Twins'],
    'tracks':  ['Creep', 'Only Shallow', 'Heaven or Las Vegas'],
    'genres':  ['shoegaze', 'dream pop', 'alternative'],
    'audio':   {'energy': 0.6, 'valence': 0.4, 'danceability': 0.4,
                'acousticness': 0.5, 'instrumentalness': 0.3, 'speechiness': 0.05},
}

PROFILE_B = {
    'artists': ['Radiohead', 'Mazzy Star', 'Cocteau Twins'],
    'tracks':  ['Creep', 'Fade Into You', 'Heaven or Las Vegas'],
    'genres':  ['shoegaze', 'indie', 'alternative'],
    'audio':   {'energy': 0.5, 'valence': 0.45, 'danceability': 0.35,
                'acousticness': 0.6, 'instrumentalness': 0.2, 'speechiness': 0.04},
}

PROFILE_C = {
    'artists': ['Drake', 'Kendrick Lamar', 'Travis Scott'],
    'tracks':  ['God\'s Plan', 'HUMBLE.', 'Sicko Mode'],
    'genres':  ['hip-hop', 'rap', 'trap'],
    'audio':   {'energy': 0.85, 'valence': 0.7, 'danceability': 0.85,
                'acousticness': 0.05, 'instrumentalness': 0.0, 'speechiness': 0.3},
}

def test_compute_score_similar_profiles():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_B)
    assert 'match_score' in result
    assert 0 <= result['match_score'] <= 100
    assert result['match_score'] > 40   # should be reasonably high
    assert 'radiohead' in result['shared_artists']
    assert 'cocteau twins' in result['shared_artists']
    assert 'creep' in result['shared_tracks']
    assert 'shoegaze' in result['shared_genres']

def test_compute_score_dissimilar_profiles():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_C)
    assert result['match_score'] < 20   # should be low
    assert len(result['shared_artists']) == 0
    assert len(result['shared_genres'])  == 0

def test_compute_score_identical():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_A)
    assert result['match_score'] == 100

def test_breakdown_keys():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_B)
    assert set(result['breakdown'].keys()) == {'artists', 'genres', 'audio', 'tracks'}

def test_rank_matches():
    engine = SoulmateEngine()
    others = [
        {**PROFILE_B, 'user_id': 'u2', 'username': 'Bob'},
        {**PROFILE_C, 'user_id': 'u3', 'username': 'Carol'},
    ]
    ranked = engine.rank_matches(PROFILE_A, others)
    assert len(ranked) == 2
    assert ranked[0]['match_score'] >= ranked[1]['match_score']
    assert ranked[0]['username'] == 'Bob'   # B is more similar to A

def test_constellation_graph():
    engine = SoulmateEngine()
    graph  = engine.build_constellation_graph(PROFILE_A, PROFILE_B)
    assert 'nodes' in graph and 'links' in graph
    types = {n['type'] for n in graph['nodes']}
    assert 'shared' in types
    # Shared nodes should include radiohead and cocteau twins
    shared_labels = {n['label'].lower() for n in graph['nodes'] if n['type'] == 'shared'}
    assert 'radiohead' in shared_labels

def test_constellation_graph_no_overlap():
    engine = SoulmateEngine()
    graph  = engine.build_constellation_graph(PROFILE_A, PROFILE_C)
    shared = [n for n in graph['nodes'] if n['type'] == 'shared']
    assert len(shared) == 0

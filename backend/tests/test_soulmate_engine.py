"""Unit tests for the richer SoulmateEngine."""
from ml.soulmate_engine import SoulmateEngine
from ml.soulmate_scoring import (
    jaccard_similarity,
    normalize_name_set,
    compute_emotional_compatibility,
    compute_mbti_compatibility,
)


PROFILE_A = {
    'user_id': 'u1',
    'username': 'essie',
    'topArtists': [
        {'name': 'Radiohead', 'genres': ['alternative', 'art rock'], 'popularity': 80},
        {'name': 'Cocteau Twins', 'genres': ['dream pop', 'shoegaze'], 'popularity': 72},
        {'name': 'Beach House', 'genres': ['dream pop', 'indie'], 'popularity': 74},
        {'name': 'Mazzy Star', 'genres': ['dream pop', 'slowcore'], 'popularity': 68},
    ],
    'topTracks': [
        {'title': 'Space Song', 'artist': 'Beach House', 'release_date': '2015-08-28', 'audio_features': {'energy': 0.32, 'valence': 0.28, 'danceability': 0.41, 'acousticness': 0.44, 'instrumentalness': 0.08}},
        {'title': 'Heaven or Las Vegas', 'artist': 'Cocteau Twins', 'release_date': '1990-09-17', 'audio_features': {'energy': 0.58, 'valence': 0.52, 'danceability': 0.44, 'acousticness': 0.22, 'instrumentalness': 0.04}},
        {'title': 'Fade Into You', 'artist': 'Mazzy Star', 'release_date': '1993-09-27', 'audio_features': {'energy': 0.27, 'valence': 0.29, 'danceability': 0.39, 'acousticness': 0.61, 'instrumentalness': 0.02}},
    ],
    'genres': [
        {'genre': 'shoegaze', 'count': 4.6},
        {'genre': 'dream pop', 'count': 4.0},
        {'genre': 'alternative', 'count': 2.5},
    ],
    'audioFeatures': {
        'energy': 0.41,
        'valence': 0.36,
        'danceability': 0.42,
        'acousticness': 0.45,
        'instrumentalness': 0.12,
        'speechiness': 0.05,
        'tempo': 108,
        'liveness': 0.14,
    },
    'mbtiType': 'INFP',
    'mbtiProfile': {
        'type': 'INFP',
        'axes': {
            'IE': {'label': 'Introvert', 'score': 86},
            'NS': {'label': 'Intuition', 'score': 72},
            'TF': {'label': 'Feeling', 'score': 82},
            'JP': {'label': 'Perceiving', 'score': 68},
        },
    },
    'personalityTraits': [
        {'id': 'dreamy', 'label': 'Dreamy', 'pct': 37, 'color': '#a78bfa'},
        {'id': 'melancholic', 'label': 'Melancholic', 'pct': 29, 'color': '#60a5fa'},
        {'id': 'nostalgic', 'label': 'Nostalgic', 'pct': 22, 'color': '#fbbf24'},
    ],
    'traitScores': {'dreamy': 0.88, 'nostalgic': 0.72, 'atmospheric': 0.9, 'lyrical': 0.62},
    'aestheticTags': ['lavender haze', 'soft focus', 'midnight'],
    'moodTags': ['dreamy', 'melancholic', 'night music'],
    'atmosphereLabels': ['shoegaze haze', 'violet static'],
    'analyticsMetrics': {'mood': 'dreamy'},
}

PROFILE_B = {
    'user_id': 'u2',
    'username': 'riley',
    'topArtists': [
        {'name': 'Radiohead', 'genres': ['alternative', 'art rock'], 'popularity': 80},
        {'name': 'Phoebe Bridgers', 'genres': ['indie folk', 'indie'], 'popularity': 78},
        {'name': 'Beach House', 'genres': ['dream pop', 'indie'], 'popularity': 74},
        {'name': 'Elliott Smith', 'genres': ['indie folk', 'singer-songwriter'], 'popularity': 67},
    ],
    'topTracks': [
        {'title': 'Space Song', 'artist': 'Beach House', 'release_date': '2015-08-28', 'audio_features': {'energy': 0.35, 'valence': 0.31, 'danceability': 0.43, 'acousticness': 0.41, 'instrumentalness': 0.06}},
        {'title': 'Motion Sickness', 'artist': 'Phoebe Bridgers', 'release_date': '2017-09-22', 'audio_features': {'energy': 0.46, 'valence': 0.39, 'danceability': 0.51, 'acousticness': 0.36, 'instrumentalness': 0.0}},
        {'title': 'Between the Bars', 'artist': 'Elliott Smith', 'release_date': '1997-02-25', 'audio_features': {'energy': 0.18, 'valence': 0.23, 'danceability': 0.31, 'acousticness': 0.81, 'instrumentalness': 0.0}},
    ],
    'genres': [
        {'genre': 'dream pop', 'count': 3.1},
        {'genre': 'indie folk', 'count': 3.9},
        {'genre': 'alternative', 'count': 2.2},
    ],
    'audioFeatures': {
        'energy': 0.39,
        'valence': 0.33,
        'danceability': 0.45,
        'acousticness': 0.47,
        'instrumentalness': 0.07,
        'speechiness': 0.04,
        'tempo': 104,
        'liveness': 0.12,
    },
    'mbtiType': 'INFJ',
    'mbtiProfile': {
        'type': 'INFJ',
        'axes': {
            'IE': {'label': 'Introvert', 'score': 81},
            'NS': {'label': 'Intuition', 'score': 78},
            'TF': {'label': 'Feeling', 'score': 74},
            'JP': {'label': 'Judging', 'score': 61},
        },
    },
    'personalityTraits': [
        {'id': 'dreamy', 'label': 'Dreamy', 'pct': 24, 'color': '#a78bfa'},
        {'id': 'nostalgic', 'label': 'Nostalgic', 'pct': 31, 'color': '#fbbf24'},
        {'id': 'romantic', 'label': 'Romantic', 'pct': 20, 'color': '#f472b6'},
    ],
    'traitScores': {'dreamy': 0.66, 'nostalgic': 0.84, 'atmospheric': 0.68, 'lyrical': 0.75},
    'aestheticTags': ['rose dust', 'silver-blue', 'midnight'],
    'moodTags': ['melancholic', 'night music', 'soft confession'],
    'atmosphereLabels': ['indie folk meadow', 'violet static'],
    'analyticsMetrics': {'mood': 'melancholic'},
}

PROFILE_C = {
    'user_id': 'u3',
    'username': 'carol',
    'topArtists': [
        {'name': 'Drake', 'genres': ['hip hop', 'rap'], 'popularity': 96},
        {'name': 'Future', 'genres': ['trap', 'rap'], 'popularity': 89},
        {'name': 'Travis Scott', 'genres': ['trap', 'hip hop'], 'popularity': 93},
    ],
    'topTracks': [
        {'title': "God's Plan", 'artist': 'Drake', 'release_date': '2018-01-19', 'audio_features': {'energy': 0.78, 'valence': 0.62, 'danceability': 0.86, 'acousticness': 0.03, 'instrumentalness': 0.0}},
        {'title': 'Sicko Mode', 'artist': 'Travis Scott', 'release_date': '2018-08-21', 'audio_features': {'energy': 0.83, 'valence': 0.56, 'danceability': 0.82, 'acousticness': 0.01, 'instrumentalness': 0.0}},
    ],
    'genres': [
        {'genre': 'hip hop', 'count': 5.2},
        {'genre': 'trap', 'count': 4.8},
        {'genre': 'rap', 'count': 3.9},
    ],
    'audioFeatures': {
        'energy': 0.82,
        'valence': 0.61,
        'danceability': 0.84,
        'acousticness': 0.05,
        'instrumentalness': 0.0,
        'speechiness': 0.19,
        'tempo': 145,
        'liveness': 0.25,
    },
    'mbtiType': 'ENTP',
    'moodTags': ['charged', 'kinetic'],
    'analyticsMetrics': {'mood': 'energetic'},
}


def test_jaccard_similarity_partial():
    assert jaccard_similarity({'a', 'b', 'c'}, {'b', 'c', 'd'}) == 0.5


def test_normalize_name_set_preserves_labels():
    mapping, ordered = normalize_name_set(['  Radiohead ', 'Beach House'])
    assert ordered == ['radiohead', 'beach house']
    assert mapping['radiohead'] == 'Radiohead'


def test_emotional_compatibility_is_high_for_adjacent_profiles():
    result = compute_emotional_compatibility(PROFILE_A, PROFILE_B)
    assert result.score >= 70
    assert 'sharedAtmosphere' in result.details


def test_mbti_compatibility_rewards_adjacent_types():
    result = compute_mbti_compatibility(PROFILE_A, PROFILE_B)
    assert result.score >= 70
    assert result.details['mbtiMatchType'] in {'complementary', 'adjacent', 'mirrored'}


def test_compute_score_returns_rich_shape():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_B)
    assert result['overallCompatibility'] >= 60
    assert result['emotionalCompatibility'] >= 60
    assert result['mbtiCompatibility'] >= 60
    assert result['relationshipArchetype']
    assert result['bridgeTracks']
    assert result['compatibilityNarrative']
    assert result['beautifulTensionNarrative']
    assert result['orbNarrative']
    assert set(result['breakdown']).issuperset({'artists', 'genres', 'audio', 'tracks', 'mbti', 'orb', 'tension'})


def test_compute_score_handles_contrast_without_zeroing_out():
    engine = SoulmateEngine()
    result = engine.compute_score(PROFILE_A, PROFILE_C)
    assert result['overallCompatibility'] < 60
    assert result['tensionScore'] > 0
    assert result['discoveryCompatibility'] >= 0
    assert result['confidence']['label'] in {'medium', 'high', 'low', 'limited'}


def test_rank_matches_prefers_the_more_emotionally_aligned_profile():
    engine = SoulmateEngine()
    ranked = engine.rank_matches(PROFILE_A, [PROFILE_C, PROFILE_B])
    assert ranked[0]['username'] == 'riley'
    assert ranked[0]['match_score'] >= ranked[1]['match_score']


def test_constellation_graph_uses_shared_artists():
    engine = SoulmateEngine()
    graph = engine.build_constellation_graph(PROFILE_A, PROFILE_B)
    shared = [node for node in graph['nodes'] if node['type'] == 'shared']
    labels = {node['label'] for node in shared}
    assert 'Radiohead' in labels
    assert 'Beach House' in labels

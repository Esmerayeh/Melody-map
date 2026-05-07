"""Unit tests for canonical Spotify music profile building helpers."""

from services.music_profile_builder import (
    _build_analytics,
    _build_aesthetic_tags,
    _build_domain_confidence,
    _fetch_audio_features,
    _build_metric_metadata,
    _compute_mbti,
    _confidence_from_ratio,
    _score_personality_archetypes,
)
from ml.graph_topology import build_galaxy_topology
from ml.representation_learning import cosine_similarity, summarize_profile_embeddings


def test_build_analytics_returns_null_for_missing_audio_metrics():
    analytics = _build_analytics(
        genres=[{'genre': 'shoegaze', 'count': 3}],
        audio_features={},
        tracks=[],
    )

    assert analytics['energyScore'] is None
    assert analytics['valenceScore'] is None
    assert analytics['tempoAvg'] is None
    assert analytics['mood'] is None


def test_metric_metadata_reports_sample_sizes_and_confidence():
    audio_rows = [
        {'energy': 0.7, 'valence': 0.5, 'danceability': 0.4, 'acousticness': 0.2, 'tempo': 120, 'speechiness': 0.05, 'instrumentalness': None},
        {'energy': 0.8, 'valence': None, 'danceability': 0.6, 'acousticness': 0.1, 'tempo': 126, 'speechiness': 0.04, 'instrumentalness': 0.2},
    ]
    analytics = _build_analytics(
        genres=[{'genre': 'shoegaze', 'count': 3}, {'genre': 'dream pop', 'count': 2}],
        audio_features={
            'energy': 0.75,
            'valence': 0.5,
            'danceability': 0.5,
            'acousticness': 0.15,
            'tempo': 123,
            'speechiness': 0.045,
            'instrumentalness': 0.2,
        },
        tracks=[{'release_date': '2018-01-01'}, {'release_date': '2020-01-01'}],
    )

    enriched = _build_metric_metadata(
        audio_features_list=audio_rows,
        requested_track_count=4,
        genres=[{'genre': 'shoegaze', 'count': 3}, {'genre': 'dream pop', 'count': 2}],
        analytics=analytics,
        tracks=[{'release_date': '2018-01-01'}, {'release_date': '2020-01-01'}],
    )

    assert enriched['sampleSizes']['energyScore'] == 2
    assert enriched['sampleSizes']['valenceScore'] == 1
    assert enriched['featureCoverageByMetric']['valence']['requested'] == 4
    assert enriched['metricConfidence']['energyScore']['label'] in {'low', 'medium', 'high'}
    assert enriched['metricConfidence']['nostalgiaIndex']['sampleSize'] == 2


def test_aesthetic_tags_do_not_invent_energy_or_valence_tags_without_audio():
    tags = _build_aesthetic_tags(
        genres=[{'genre': 'shoegaze', 'count': 3}],
        energy=None,
        valence=None,
    )

    assert 'electric' not in tags
    assert 'radiant' not in tags
    assert 'dreamcore' in tags


def test_confidence_ratio_zero_is_unavailable():
    confidence = _confidence_from_ratio(0)

    assert confidence['score'] == 0
    assert confidence['label'] == 'unavailable'


def test_personality_is_partial_but_not_faked_without_audio():
    personality = _score_personality_archetypes(
        audio_features={},
        genres=[{'genre': 'shoegaze', 'count': 4}, {'genre': 'dream pop', 'count': 3}],
    )

    assert personality['traits'] is not None
    assert personality['confidence'] <= 0.45
    assert 'genres' in personality['inputsUsed']


def test_mbti_requires_audio_genres_and_artists():
    mbti = _compute_mbti(
        audio_features={'acousticness': None, 'danceability': None, 'instrumentalness': None, 'valence': None},
        genres=[],
        artists=[],
    )

    assert mbti['value'] is None
    assert mbti['confidence'] == 0
    assert 'genres' in mbti['missingInputs']


def test_domain_confidence_uses_audio_coverage_and_catalog_size():
    confidence = _build_domain_confidence(
        audio_coverage=0.82,
        top_artists_count=50,
        top_tracks_count=50,
        genres_count=10,
        personality_meta={'confidence': 0.74},
        mbti_meta={'confidence': 0.61},
    )

    assert confidence['analytics']['label'] in {'medium', 'high'}
    assert confidence['identity']['score'] > 0.5
    assert confidence['soulmate']['score'] > 0.5


def test_fetch_audio_features_falls_back_to_single_track_endpoint(monkeypatch):
    class FakeResponse:
        def __init__(self, ok, payload, status_code=200, text=''):
            self.ok = ok
            self._payload = payload
            self.status_code = status_code
            self.text = text

        def json(self):
            return self._payload

    calls = []

    def fake_get(url, headers=None, params=None, timeout=10):
        calls.append((url, params))
        if url.endswith('/audio-features'):
            return FakeResponse(True, {'audio_features': [None, None]})
        if url.endswith('/audio-features/track-1'):
            return FakeResponse(True, {'id': 'track-1', 'energy': 0.8, 'valence': 0.6, 'danceability': 0.7, 'acousticness': 0.2, 'instrumentalness': 0.0, 'speechiness': 0.05, 'tempo': 123, 'loudness': -6})
        if url.endswith('/audio-features/track-2'):
            return FakeResponse(True, {'id': 'track-2', 'energy': 0.5, 'valence': 0.4, 'danceability': 0.6, 'acousticness': 0.3, 'instrumentalness': 0.1, 'speechiness': 0.04, 'tempo': 118, 'loudness': -8})
        return FakeResponse(False, {}, status_code=404, text='not found')

    monkeypatch.setattr('services.music_profile_builder.req.get', fake_get)
    monkeypatch.setattr('services.music_profile_builder._get_spotify_service', lambda: None)

    rows, diagnostics = _fetch_audio_features(['track-1', 'track-2'], 'https://api.spotify.com/v1', {'Authorization': 'Bearer token'})

    assert len(rows) == 2
    assert diagnostics['fallbackUsed'] is True
    assert diagnostics['source'] == 'spotify_single_user_token'
    assert any('/audio-features/track-1' in call[0] for call in calls)


def test_profile_representation_vectors_are_deterministic():
    profile = {
        'topArtists': [{'name': 'Beach House', 'genres': ['dream pop']}],
        'topTracks': [{'title': 'Space Song', 'artist': 'Beach House'}],
        'genres': [{'genre': 'dream pop', 'count': 3}],
        'audioFeatures': {'energy': 0.3, 'valence': 0.2, 'danceability': 0.4},
        'analyticsMetrics': {'mood': 'dreamy'},
        'mbtiType': 'INFP',
    }

    first = summarize_profile_embeddings(profile)
    second = summarize_profile_embeddings(profile)

    assert first['embeddingVersion']
    assert first['profileVector'] == second['profileVector']
    assert cosine_similarity(first['profileVector'], second['profileVector']) >= 0.99


def test_galaxy_topology_assigns_communities():
    topology = build_galaxy_topology([
        {'id': 'g1', 'type': 'genre', 'label': 'dream pop'},
        {'id': 'a1', 'type': 'artist', 'name': 'Beach House', 'genre': 'dream pop'},
        {'id': 'a2', 'type': 'artist', 'name': 'Cocteau Twins', 'genre': 'dream pop'},
    ])

    assert topology['communityCount'] >= 1
    assert 'a1' in topology['communities']
    assert 'a2' in topology['nodeVectors']

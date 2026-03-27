"""Unit tests for canonical Spotify music profile building helpers."""

from services.music_profile_builder import (
    _build_analytics,
    _build_aesthetic_tags,
    _build_metric_metadata,
    _confidence_from_ratio,
)


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
        track_count=4,
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

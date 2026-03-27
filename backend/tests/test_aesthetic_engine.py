"""Tests for the data-driven Melody Map aesthetic engine."""

from ml.aesthetic_engine import build_aesthetic_report


def _profile(
    genres,
    audio,
    artists,
    tracks,
    audio_rows=None,
    data_quality=None,
):
    return {
        'genres': genres,
        'audioFeatures': audio,
        'topArtists': artists,
        'topTracks': tracks,
        'audioFeaturesList': audio_rows or [],
        'analyticsMetrics': {
            'mood': 'balanced',
            'diversityScore': 58,
        },
        'dataQuality': data_quality or {
            'audioCoverage': 0.86,
            'topArtistsCount': len(artists),
            'topTracksCount': len(tracks),
            'genresCount': len(genres),
            'hasAudioProfile': True,
        },
    }


def test_shoegaze_profile_maps_to_shoegaze_or_celestial_family():
    report = build_aesthetic_report(_profile(
        genres=[
            {'genre': 'shoegaze', 'count': 6},
            {'genre': 'dream pop', 'count': 5},
            {'genre': 'slowcore', 'count': 2},
        ],
        audio={
            'energy': 0.37,
            'valence': 0.33,
            'danceability': 0.31,
            'acousticness': 0.41,
            'instrumentalness': 0.22,
            'tempo': 93,
        },
        artists=[
            {'name': 'Slowdive', 'popularity': 57, 'genres': ['shoegaze', 'dream pop']},
            {'name': 'Cocteau Twins', 'popularity': 62, 'genres': ['dream pop']},
            {'name': 'Beach House', 'popularity': 71, 'genres': ['dream pop']},
        ],
        tracks=[
            {'title': 'Alison', 'release_date': '1993-01-01'},
            {'title': 'When the Sun Hits', 'release_date': '1993-01-01'},
            {'title': 'Myth', 'release_date': '2012-01-01'},
        ],
        audio_rows=[
            {'energy': 0.35, 'valence': 0.3, 'danceability': 0.28, 'acousticness': 0.44},
            {'energy': 0.41, 'valence': 0.36, 'danceability': 0.33, 'acousticness': 0.39},
            {'energy': 0.39, 'valence': 0.35, 'danceability': 0.31, 'acousticness': 0.42},
        ],
    ))

    assert report['primaryAesthetic']['id'] in {'shoegaze_haze', 'celestial_romantic'}
    assert report['supportingSignals']['genreEvidence']
    assert 'shoegaze' in ' '.join(report['supportingSignals']['genreEvidence'])


def test_jazz_profile_maps_to_noir_or_jazz_family():
    report = build_aesthetic_report(_profile(
        genres=[
            {'genre': 'jazz', 'count': 7},
            {'genre': 'vocal jazz', 'count': 4},
            {'genre': 'blues', 'count': 2},
        ],
        audio={
            'energy': 0.34,
            'valence': 0.31,
            'danceability': 0.35,
            'acousticness': 0.67,
            'instrumentalness': 0.46,
            'tempo': 88,
        },
        artists=[
            {'name': 'Chet Baker', 'popularity': 55, 'genres': ['jazz']},
            {'name': 'Miles Davis', 'popularity': 68, 'genres': ['jazz']},
            {'name': 'Billie Holiday', 'popularity': 61, 'genres': ['jazz', 'vocal jazz']},
        ],
        tracks=[
            {'title': 'My Funny Valentine', 'release_date': '1954-01-01'},
            {'title': 'Blue in Green', 'release_date': '1959-01-01'},
            {'title': 'Strange Fruit', 'release_date': '1939-01-01'},
        ],
        audio_rows=[
            {'energy': 0.31, 'valence': 0.28, 'danceability': 0.32, 'acousticness': 0.72},
            {'energy': 0.35, 'valence': 0.34, 'danceability': 0.36, 'acousticness': 0.64},
            {'energy': 0.37, 'valence': 0.31, 'danceability': 0.35, 'acousticness': 0.65},
        ],
    ))

    assert report['primaryAesthetic']['id'] in {'jazz_smoke', 'velvet_noir'}
    assert report['supportingSignals']['artistEvidence']
    assert report['explanation']


def test_hyperpop_profile_maps_to_glitch_angel_or_electric_maximalist():
    report = build_aesthetic_report(_profile(
        genres=[
            {'genre': 'hyperpop', 'count': 6},
            {'genre': 'electropop', 'count': 4},
            {'genre': 'alt-pop', 'count': 3},
        ],
        audio={
            'energy': 0.76,
            'valence': 0.53,
            'danceability': 0.74,
            'acousticness': 0.08,
            'instrumentalness': 0.06,
            'tempo': 131,
        },
        artists=[
            {'name': 'Charli XCX', 'popularity': 82, 'genres': ['hyperpop', 'electropop']},
            {'name': 'SOPHIE', 'popularity': 63, 'genres': ['hyperpop']},
            {'name': 'yeule', 'popularity': 58, 'genres': ['alt-pop', 'glitch pop']},
        ],
        tracks=[
            {'title': 'Vroom Vroom', 'release_date': '2016-01-01'},
            {'title': 'Immaterial', 'release_date': '2018-01-01'},
            {'title': 'Bites on My Neck', 'release_date': '2023-01-01'},
        ],
        audio_rows=[
            {'energy': 0.72, 'valence': 0.49, 'danceability': 0.71, 'acousticness': 0.09},
            {'energy': 0.79, 'valence': 0.55, 'danceability': 0.77, 'acousticness': 0.06},
            {'energy': 0.77, 'valence': 0.54, 'danceability': 0.75, 'acousticness': 0.08},
        ],
    ))

    assert report['primaryAesthetic']['id'] in {'glitch_angel', 'electric_maximalist'}
    assert report['secondaryAesthetics']


def test_low_data_profile_reduces_confidence_and_reports_uncertainty():
    report = build_aesthetic_report(_profile(
        genres=[{'genre': 'indie rock', 'count': 1}],
        audio={
            'energy': None,
            'valence': None,
            'danceability': None,
            'acousticness': None,
            'instrumentalness': None,
            'tempo': None,
        },
        artists=[{'name': 'Unknown Artist', 'popularity': None, 'genres': []}],
        tracks=[{'title': 'Unknown Song'}],
        audio_rows=[],
        data_quality={
            'audioCoverage': 0.0,
            'topArtistsCount': 1,
            'topTracksCount': 1,
            'genresCount': 1,
            'hasAudioProfile': False,
        },
    ))

    assert report['confidence']['label'] in {'low', 'insufficient'}
    assert report['confidence']['reasons']
    assert 'spotify_audio_features_missing' in report['confidence']['reasons']


def test_different_profiles_produce_meaningfully_different_primary_aesthetics():
    dream = build_aesthetic_report(_profile(
        genres=[{'genre': 'shoegaze', 'count': 4}, {'genre': 'dream pop', 'count': 3}],
        audio={'energy': 0.38, 'valence': 0.35, 'danceability': 0.3, 'acousticness': 0.45, 'instrumentalness': 0.2, 'tempo': 95},
        artists=[{'name': 'Slowdive', 'popularity': 57, 'genres': ['shoegaze']}],
        tracks=[{'title': 'Alison', 'release_date': '1993-01-01'}],
    ))
    folk = build_aesthetic_report(_profile(
        genres=[{'genre': 'indie folk', 'count': 4}, {'genre': 'folk', 'count': 3}],
        audio={'energy': 0.29, 'valence': 0.52, 'danceability': 0.26, 'acousticness': 0.81, 'instrumentalness': 0.14, 'tempo': 87},
        artists=[{'name': 'Adrianne Lenker', 'popularity': 61, 'genres': ['indie folk']}],
        tracks=[{'title': 'anything', 'release_date': '2020-01-01'}],
    ))

    assert dream['primaryAesthetic']['id'] != folk['primaryAesthetic']['id']


def test_explanation_uses_supporting_signal_content():
    report = build_aesthetic_report(_profile(
        genres=[{'genre': 'post-punk', 'count': 5}, {'genre': 'darkwave', 'count': 3}],
        audio={'energy': 0.57, 'valence': 0.24, 'danceability': 0.55, 'acousticness': 0.18, 'instrumentalness': 0.15, 'tempo': 114},
        artists=[{'name': 'Joy Division', 'popularity': 69, 'genres': ['post-punk']}],
        tracks=[{'title': 'Disorder', 'release_date': '1979-01-01'}],
    ))

    explanation = report['explanation'].lower()
    assert 'genre evidence' in explanation or 'artist worlds' in explanation or 'artist world' in explanation

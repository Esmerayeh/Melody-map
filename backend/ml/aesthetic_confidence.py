"""
Confidence helpers for the Melody Map aesthetic engine.
"""

from __future__ import annotations


def _label(score: float) -> str:
    if score >= 0.8:
        return 'high'
    if score >= 0.5:
        return 'medium'
    if score > 0:
        return 'low'
    return 'insufficient'


def compute_aesthetic_confidence(profile_input: dict, signal_counts: dict) -> dict:
    data_quality = profile_input.get('dataQuality') or {}
    top_artists_count = min(50, len(profile_input.get('topArtists') or []))
    top_tracks_count = min(50, len(profile_input.get('topTracks') or []))
    genres_count = len(profile_input.get('genres') or [])

    audio_coverage = float(data_quality.get('audioCoverage') or 0.0)
    genre_score = min(1.0, genres_count / 10) if genres_count else 0.0
    artists_score = min(1.0, top_artists_count / 50)
    tracks_score = min(1.0, top_tracks_count / 50)
    era_score = min(1.0, signal_counts.get('era_years', 0) / 20) if signal_counts.get('era_years') else 0.0
    popularity_score = 1.0 if signal_counts.get('artist_popularity_count', 0) >= 10 else min(1.0, signal_counts.get('artist_popularity_count', 0) / 10)
    variance_score = 1.0 if signal_counts.get('variance_features', 0) >= 3 else min(1.0, signal_counts.get('variance_features', 0) / 3)

    score = round(
        (audio_coverage * 0.38) +
        (genre_score * 0.16) +
        (artists_score * 0.14) +
        (tracks_score * 0.1) +
        (era_score * 0.1) +
        (popularity_score * 0.06) +
        (variance_score * 0.06),
        3,
    )

    reasons = []
    if audio_coverage == 0:
        reasons.append('spotify_audio_features_missing')
    elif audio_coverage < 0.6:
        reasons.append('spotify_audio_feature_coverage_low')
    if genres_count < 4:
        reasons.append('genre_profile_sparse')
    if top_artists_count < 15:
        reasons.append('top_artist_sample_small')
    if top_tracks_count < 15:
        reasons.append('top_track_sample_small')
    if signal_counts.get('era_years', 0) < 5:
        reasons.append('era_distribution_weak')
    if signal_counts.get('artist_popularity_count', 0) < 5:
        reasons.append('discovery_signal_weak')

    return {
        'score': score,
        'label': _label(score),
        'reasons': reasons,
        'inputs': {
            'audioCoverage': round(audio_coverage, 3),
            'topArtistsCount': top_artists_count,
            'topTracksCount': top_tracks_count,
            'genresCount': genres_count,
            'eraYears': signal_counts.get('era_years', 0),
            'artistPopularityCount': signal_counts.get('artist_popularity_count', 0),
            'varianceFeatures': signal_counts.get('variance_features', 0),
        },
    }

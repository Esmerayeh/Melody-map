"""
Aesthetic engine for Melody Map.

This module converts a canonical music profile into a structured aesthetic identity
grounded in:
- canonical top artists / top tracks
- genre distribution
- real Spotify audio-feature aggregates
- audio-feature spread
- era distribution
- discovery and popularity tendencies
- structural profile cues
"""

from __future__ import annotations

import math
import random
from collections import Counter

from ml.aesthetic_categories import AESTHETIC_CATEGORIES, DEFAULT_AESTHETIC_ID
from ml.aesthetic_confidence import compute_aesthetic_confidence
from ml.aesthetic_explainer import build_aesthetic_explanation


def _normalize(value: float | None, fallback: float | None = None) -> float | None:
    if value is None:
        return fallback
    return max(0.0, min(1.0, float(value)))


def _normalize_tempo(value: float | None) -> float | None:
    if value is None:
        return None
    return max(0.0, min(1.0, float(value) / 200.0))


def _proximity(actual: float | None, target: float | None, normalized: bool = True) -> float | None:
    if actual is None or target is None:
        return None
    if normalized:
        return max(0.0, 1.0 - abs(actual - target))
    return max(0.0, 1.0 - abs(actual - target) / 100.0)


def _weighted_mean(parts: list[tuple[float | None, float]]) -> float | None:
    valid = [(value, weight) for value, weight in parts if value is not None and weight > 0]
    if not valid:
        return None
    weight_sum = sum(weight for _, weight in valid) or 1.0
    return sum(value * weight for value, weight in valid) / weight_sum


def _safe_list(value) -> list:
    return value if isinstance(value, list) else []


def _extract_genres(raw_genres) -> list[dict]:
    genres = []
    for item in _safe_list(raw_genres):
        if isinstance(item, dict):
            genre = str(item.get('genre') or '').strip().lower()
            count = int(item.get('count') or 0)
            if genre:
                genres.append({'genre': genre, 'count': max(1, count)})
        elif isinstance(item, str):
            genre = item.strip().lower()
            if genre:
                genres.append({'genre': genre, 'count': 1})
    counts = Counter()
    for item in genres:
        counts[item['genre']] += item['count']
    return [{'genre': genre, 'count': count} for genre, count in counts.most_common()]


def _extract_artists(raw_artists) -> list[dict]:
    artists = []
    for item in _safe_list(raw_artists):
        if isinstance(item, dict):
            artists.append({
                'name': item.get('name') or item.get('label') or '',
                'popularity': item.get('popularity'),
                'genres': _safe_list(item.get('genres')),
            })
        elif isinstance(item, str):
            artists.append({'name': item, 'popularity': None, 'genres': []})
    return [artist for artist in artists if artist['name']]


def _extract_tracks(raw_tracks) -> list[dict]:
    tracks = []
    for item in _safe_list(raw_tracks):
        if isinstance(item, dict):
            tracks.append(item)
        elif isinstance(item, str):
            tracks.append({'title': item})
    return tracks


def _extract_audio_features(raw_audio_features) -> dict:
    if not isinstance(raw_audio_features, dict):
        return {}
    return {
        'energy': _normalize(raw_audio_features.get('energy')),
        'valence': _normalize(raw_audio_features.get('valence')),
        'danceability': _normalize(raw_audio_features.get('danceability')),
        'acousticness': _normalize(raw_audio_features.get('acousticness')),
        'instrumentalness': _normalize(raw_audio_features.get('instrumentalness')),
        'speechiness': _normalize(raw_audio_features.get('speechiness')),
        'tempo': raw_audio_features.get('tempo'),
        'loudness': raw_audio_features.get('loudness'),
    }


def _release_year(track: dict) -> int | None:
    direct = track.get('release_year') or track.get('year')
    if direct is not None:
        try:
            return int(direct)
        except (TypeError, ValueError):
            return None
    release_date = str(track.get('release_date') or '')
    if len(release_date) >= 4 and release_date[:4].isdigit():
        return int(release_date[:4])
    return None


def _build_input(data: dict) -> dict:
    genres = _extract_genres(data.get('genres'))
    artists = _extract_artists(data.get('topArtists') or data.get('top_artists'))
    tracks = _extract_tracks(data.get('topTracks') or data.get('top_tracks'))
    audio_features = _extract_audio_features(data.get('audioFeatures') or data.get('audio_features'))
    audio_features_list = _safe_list(data.get('audioFeaturesList') or data.get('audio_features_list'))
    analytics = data.get('analyticsMetrics') or data.get('analytics_metrics') or {}
    data_quality = data.get('dataQuality') or data.get('data_quality') or {}
    confidence = data.get('confidence') or {}

    return {
        'genres': genres,
        'topArtists': artists[:50],
        'topTracks': tracks[:50],
        'audioFeatures': audio_features,
        'audioFeaturesList': audio_features_list[:50],
        'analyticsMetrics': analytics,
        'dataQuality': data_quality,
        'confidence': confidence,
    }


def _genre_matches(category: dict, genres: list[dict]) -> tuple[float, list[str]]:
    if not genres:
        return 0.0, []
    total_weight = sum(item['count'] for item in genres) or 1
    hits = []
    score = 0.0
    for item in genres:
        genre = item['genre']
        for keyword in category['genre_keywords']:
            if keyword in genre:
                hits.append(genre)
                score += item['count'] / total_weight
                break
    return min(1.0, score), hits[:4]


def _artist_matches(category: dict, artists: list[dict]) -> tuple[float, list[str]]:
    if not artists:
        return 0.0, []
    limit = min(12, len(artists))
    hits = []
    score = 0.0
    for index, artist in enumerate(artists[:limit]):
        name = artist['name'].lower()
        for keyword in category['artist_keywords']:
            if keyword in name:
                hits.append(artist['name'])
                score += (limit - index) / limit
                break
    return min(1.0, score / 2.5), hits[:4]


def _feature_variance(audio_features_list: list[dict], key: str) -> float | None:
    values = [float(item[key]) for item in audio_features_list if isinstance(item, dict) and item.get(key) is not None]
    if len(values) < 2:
        return None
    avg = sum(values) / len(values)
    variance = sum((value - avg) ** 2 for value in values) / len(values)
    return variance


def _era_distribution(tracks: list[dict]) -> tuple[dict, list[int]]:
    years = [year for year in (_release_year(track) for track in tracks) if year is not None]
    if not years:
        return {}, []
    bins = {
        '1950s': 0,
        '1960s': 0,
        '1970s': 0,
        '1980s': 0,
        '1990s': 0,
        '2000s': 0,
        '2010s': 0,
        '2020s': 0,
    }
    for year in years:
        decade = min(2020, max(1950, (year // 10) * 10))
        label = f'{decade}s'
        if label in bins:
            bins[label] += 1
    total = len(years) or 1
    distribution = {decade: round(count / total, 3) for decade, count in bins.items() if count > 0}
    return distribution, years


def _discovery_score(artists: list[dict]) -> tuple[float | None, int]:
    popularities = [int(artist['popularity']) for artist in artists if artist.get('popularity') is not None]
    if not popularities:
        return None, 0
    avg_popularity = sum(popularities) / len(popularities)
    return round(max(0.0, min(1.0, 1 - (avg_popularity / 100.0))), 3), len(popularities)


def _contrast_score(audio_features_list: list[dict]) -> float | None:
    variances = [
        _feature_variance(audio_features_list, key)
        for key in ['energy', 'valence', 'danceability', 'acousticness']
    ]
    valid = [value for value in variances if value is not None]
    if not valid:
        return None
    return round(max(0.0, min(1.0, (sum(valid) / len(valid)) * 4)), 3)


def _structure_signals(profile_input: dict) -> dict:
    analytics = profile_input['analyticsMetrics']
    diversity = analytics.get('diversityScore')
    if diversity is not None:
        diversity = round(float(diversity) / 100.0, 3)
    contrast = _contrast_score(profile_input['audioFeaturesList'])
    discovery, popularity_count = _discovery_score(profile_input['topArtists'])
    era_distribution, years = _era_distribution(profile_input['topTracks'])
    return {
        'diversity': diversity,
        'contrast': contrast,
        'discovery': discovery,
        'eraDistribution': era_distribution,
        'releaseYears': years,
        'artistPopularityCount': popularity_count,
        'eraYears': len(years),
        'varianceFeatures': sum(
            1 for key in ['energy', 'valence', 'danceability', 'acousticness']
            if _feature_variance(profile_input['audioFeaturesList'], key) is not None
        ),
    }


def _score_category(category: dict, profile_input: dict, structure: dict) -> dict:
    genres = profile_input['genres']
    artists = profile_input['topArtists']
    audio = profile_input['audioFeatures']

    genre_score, genre_hits = _genre_matches(category, genres)
    artist_score, artist_hits = _artist_matches(category, artists)

    audio_scores = []
    supporting_audio = []
    for key, target in category['audio_targets'].items():
        weight = category['audio_weights'].get(key, 0.5)
        if key == 'tempo':
            actual = audio.get('tempo')
            score = _proximity(actual, target, normalized=False)
        else:
            actual = audio.get(key)
            score = _proximity(actual, target)
        audio_scores.append((score, weight))
        if score is not None and score >= 0.7:
            supporting_audio.append(key)
    audio_score = _weighted_mean(audio_scores)

    era_distribution = structure['eraDistribution']
    era_scores = []
    for decade, target in category['era_targets'].items():
        actual = era_distribution.get(decade)
        if actual is not None:
            era_scores.append((1 - abs(actual - target), target))
    era_score = _weighted_mean(era_scores)

    discovery_score = None
    if structure['discovery'] is not None:
        discovery_score = max(0.0, 1 - abs(structure['discovery'] - category['discovery_target']))
    diversity_score = None
    if structure['diversity'] is not None:
        diversity_score = max(0.0, 1 - abs(structure['diversity'] - category['diversity_target']))

    total = _weighted_mean([
        (genre_score, 0.34),
        (artist_score, 0.16),
        (audio_score, 0.3),
        (era_score, 0.08),
        (discovery_score, 0.07),
        (diversity_score, 0.05),
    ]) or 0.0

    reasons = []
    if genre_hits:
        reasons.append(f"genre evidence from {', '.join(genre_hits[:2])}")
    if artist_hits:
        reasons.append(f"artist world overlap with {', '.join(artist_hits[:2])}")
    if supporting_audio:
        reasons.append(f"audio profile matched on {', '.join(supporting_audio[:3])}")
    if discovery_score is not None and discovery_score >= 0.7:
        reasons.append('discovery profile matched')
    if era_score is not None and era_score >= 0.7:
        reasons.append('era distribution matched')

    return {
        **category,
        'score': round(total, 4),
        'componentScores': {
            'genre': round(genre_score, 4),
            'artist': round(artist_score, 4),
            'audio': round(audio_score, 4) if audio_score is not None else None,
            'era': round(era_score, 4) if era_score is not None else None,
            'discovery': round(discovery_score, 4) if discovery_score is not None else None,
            'diversity': round(diversity_score, 4) if diversity_score is not None else None,
        },
        'supportingGenreEvidence': genre_hits,
        'supportingArtistEvidence': artist_hits,
        'why_not': reasons,
    }


def _normalize_scores(scored: list[dict]) -> list[dict]:
    total = sum(item['score'] for item in scored) or 1.0
    for item in scored:
        item['weight'] = round(item['score'] / total, 4)
        item['weightPct'] = round(item['weight'] * 100)
    return scored


def _top_blend(scored: list[dict]) -> tuple[dict, list[dict], list[dict]]:
    ordered = sorted(scored, key=lambda item: item['score'], reverse=True)
    if not ordered:
        default = next(category for category in AESTHETIC_CATEGORIES if category['id'] == DEFAULT_AESTHETIC_ID)
        return {**default, 'score': 0.0, 'weight': 1.0, 'weightPct': 100, 'componentScores': {}, 'supportingGenreEvidence': [], 'supportingArtistEvidence': []}, [], []
    if ordered[0]['score'] <= 0.0001:
        default = next(category for category in AESTHETIC_CATEGORIES if category['id'] == DEFAULT_AESTHETIC_ID)
        primary = {
            **default,
            'score': 0.0,
            'weight': 1.0,
            'weightPct': 100,
            'componentScores': {
                'genre': 0.0,
                'artist': 0.0,
                'audio': None,
                'era': None,
                'discovery': None,
                'diversity': None,
            },
            'supportingGenreEvidence': [],
            'supportingArtistEvidence': [],
            'why_not': ['insufficient data for a stronger category match'],
        }
        return primary, [], []
    primary = ordered[0]
    secondary = [item for item in ordered[1:5] if item['weightPct'] >= 9]
    rejected = []
    for item in ordered[1:4]:
        reasons = []
        if item['componentScores']['genre'] < primary['componentScores']['genre']:
            reasons.append('weaker genre support')
        if (item['componentScores']['audio'] or 0) < (primary['componentScores']['audio'] or 0):
            reasons.append('weaker audio-feature fit')
        if not reasons:
            reasons.append('the overall blend support was weaker')
        rejected.append({'label': item['label'], 'why_not': reasons})
    return primary, secondary, rejected


def _mood_descriptors(profile_input: dict) -> list[str]:
    analytics = profile_input['analyticsMetrics']
    descriptors = []
    if analytics.get('mood'):
        descriptors.append(str(analytics['mood']).replace('_', ' '))
    audio = profile_input['audioFeatures']
    if audio.get('energy') is not None:
        descriptors.append('soft intensity' if audio['energy'] < 0.45 else 'driven intensity' if audio['energy'] > 0.7 else 'measured motion')
    if audio.get('valence') is not None:
        descriptors.append('luminous melancholy' if audio['valence'] < 0.4 else 'warm brightness' if audio['valence'] > 0.62 else 'bittersweet balance')
    return descriptors[:3]


def _era_influence(structure: dict) -> dict:
    distribution = structure['eraDistribution']
    if not distribution:
        return {'dominant': [], 'summary': 'Era influence is weak because release-year evidence is limited.'}
    ranked = sorted(distribution.items(), key=lambda item: item[1], reverse=True)
    dominant = [{'era': era, 'weight': weight} for era, weight in ranked[:3]]
    labels = [item['era'] for item in dominant]
    return {
        'dominant': dominant,
        'summary': f"Release-year influence leans toward {', '.join(labels)}.",
    }


def _supporting_signals(primary: dict, profile_input: dict, structure: dict, confidence: dict) -> dict:
    audio = profile_input['audioFeatures']
    genres = [item['genre'] for item in profile_input['genres'][:5]]
    artists = [item['name'] for item in profile_input['topArtists'][:5]]
    return {
        'genreEvidence': primary['supportingGenreEvidence'] or genres[:3],
        'artistEvidence': primary['supportingArtistEvidence'] or artists[:3],
        'audioEvidence': [
            f"energy {round(audio['energy'] * 100)}%" for _ in [0] if audio.get('energy') is not None
        ] + [
            f"valence {round(audio['valence'] * 100)}%" for _ in [0] if audio.get('valence') is not None
        ] + [
            f"acousticness {round(audio['acousticness'] * 100)}%" for _ in [0] if audio.get('acousticness') is not None
        ] + [
            f"tempo {round(audio['tempo'])} bpm" for _ in [0] if audio.get('tempo') is not None
        ],
        'moodEvidence': _mood_descriptors(profile_input),
        'eraEvidence': [item['era'] for item in _era_influence(structure)['dominant']],
        'discoveryEvidence': [
            'niche-leaning discovery profile' if structure['discovery'] is not None and structure['discovery'] >= 0.65 else
            'balanced popularity profile' if structure['discovery'] is not None and structure['discovery'] >= 0.4 else
            'mainstream-facing comfort profile'
        ] if structure['discovery'] is not None else [],
        'confidenceReasons': confidence['reasons'],
    }


def _generate_palette(primary: dict, secondary: list[dict]) -> list[str]:
    colors = primary.get('palette_hints') or []
    secondary_hints = [hint for item in secondary for hint in item.get('palette_hints', [])[:1]]
    seed_terms = colors[:3] + secondary_hints[:2]
    palette_map = {
        'indigo mist': '#5c6ac4',
        'lavender fog': '#a78bfa',
        'deep periwinkle': '#6d7cff',
        'moon-silver': '#d5d7e6',
        'wine black': '#2b1021',
        'amber smoke': '#b36a3c',
        'bronzed plum': '#7b4869',
        'midnight mahogany': '#341f2e',
        'cyber pink': '#ff5db1',
        'cold lilac': '#c5b7ff',
        'electric chrome': '#6ef3ff',
        'ice-blue neon': '#89d9ff',
        'wheat gold': '#d8b26a',
        'moss green': '#708d5d',
        'dusty cream': '#d8d1bf',
        'faded terracotta': '#b87663',
        'burnished gold': '#c79d4f',
        'aged brown': '#7a5b42',
        'faded denim': '#64788a',
        'autumn amber': '#d07a3d',
        'graphite': '#4b4f59',
        'inky violet': '#4d3c7e',
        'smoked blue': '#54657d',
        'ashen silver': '#b4bac6',
        'rose-lilac': '#c78bcf',
        'soft gold': '#e4c56f',
        'opal blue': '#94bcd9',
        'night plum': '#5d355f',
        'hot magenta': '#ff4db8',
        'electric cyan': '#56e8ff',
        'acid lime': '#cbff5e',
        'stage gold': '#f4bc42',
        'amber brown': '#8e5a33',
        'tarnished gold': '#b18f52',
        'oxblood': '#6b283c',
        'smoke gray': '#8d8d97',
        'storm blue': '#5e6a86',
        'dust rose': '#b9838d',
        'fading violet': '#7763a8',
        'cloud silver': '#cfd5de',
        'dusty rose': '#b88596',
        'cool beige': '#d2c7ba',
        'ink blue': '#54647f',
        'soft plum': '#89628c',
    }
    palette = [palette_map[term] for term in seed_terms if term in palette_map]
    while len(palette) < 5:
        palette.append(['#1a1a2e', '#3a0ca3', '#7209b7', '#f72585', '#4361ee'][len(palette)])
    return palette[:5]


def _generate_tags(primary: dict, secondary: list[dict], support: dict) -> list[str]:
    tags = []
    tags.extend(primary.get('palette_hints', [])[:2])
    tags.extend(primary.get('texture_hints', [])[:2])
    tags.extend(primary.get('visual_mood', [])[:2])
    tags.extend(primary.get('cultural_descriptors', [])[:2])
    tags.extend(support.get('genreEvidence', [])[:2])
    tags.extend([item['label'].lower() for item in secondary[:2]])
    deduped = []
    seen = set()
    for tag in tags:
        key = tag.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(tag)
    return deduped[:12]


def generate_personality(genres: list[str], energy: float | None, valence: float | None, tempo: float | None) -> dict:
    label = 'Sonic Explorer'
    description = 'Your listening moves across moods and scenes without collapsing into one narrow lane.'
    traits = ['curious', 'atmospheric', 'interpretive']

    genre_text = ' '.join((genres or [])).lower()
    if 'shoegaze' in genre_text or 'dream pop' in genre_text:
        label = 'Dreamlit Listener'
        description = 'You gravitate toward softness, blur, and emotional resonance carried by atmosphere.'
        traits = ['ethereal', 'introspective', 'luminous']
    elif 'jazz' in genre_text or 'neo-soul' in genre_text:
        label = 'Midnight Romantic'
        description = 'You lean toward low-lit elegance, emotional detail, and richly textured intimacy.'
        traits = ['smoky', 'tender', 'sophisticated']
    elif energy is not None and energy > 0.72 and (tempo or 0) > 120:
        label = 'Voltage Chaser'
        description = 'You seek motion, brightness, and vivid impact when you press play.'
        traits = ['kinetic', 'restless', 'charged']
    elif valence is not None and valence < 0.35:
        label = 'Twilight Archivist'
        description = 'You favor shadowed feeling, reflective weight, and music that glows at the edges.'
        traits = ['brooding', 'poetic', 'nocturnal']

    return {
        'name': label,
        'description': description,
        'traits': traits,
    }


def generate_shared_aesthetic(
    tags_a: list[str],
    tags_b: list[str],
    shared_genres: list[str],
    shared_artists: list[str],
) -> dict:
    overlap = sorted(set(tag.lower() for tag in tags_a) & set(tag.lower() for tag in tags_b))
    tags = overlap[:8] + shared_genres[:2] + shared_artists[:2]
    tags = list(dict.fromkeys(tags))
    seed = ''.join(tags) or ''.join(shared_genres[:2]) or 'melody-map-shared'
    rng = random.Random(hash(seed) % (2 ** 32))
    prefix = rng.choice(['Velvet', 'Neon', 'Midnight', 'Lunar', 'Golden'])
    noun = rng.choice(['Resonance', 'Orbit', 'Frequency', 'Drift', 'Signal'])
    if shared_genres:
        vibe = f"Your shared aesthetic is anchored by {', '.join(shared_genres[:3])}, creating a visual language you both recognize."
    elif shared_artists:
        vibe = f"Your shared aesthetic is shaped by recurring artists like {', '.join(shared_artists[:2])}."
    else:
        vibe = 'Your tastes overlap in feeling more than category, creating a blended visual orbit.'
    return {
        'shared_aesthetic_name': f'{prefix} {noun}',
        'shared_tags': tags[:12],
        'shared_vibe': vibe,
    }


def classify_vibe(energy: float, valence: float, tempo: float, genres: list[str] | None = None) -> dict:
    if energy >= 0.72 and valence >= 0.6:
        label = 'Radiant Kinetic Bloom'
        description = 'Fast-moving, bright, and high-lift.'
        hex_color = '#ff6ec7'
    elif energy >= 0.68 and valence < 0.45:
        label = 'Electric Shadow Surge'
        description = 'High energy with a darker undertow.'
        hex_color = '#7c3aed'
    elif energy < 0.42 and valence < 0.4:
        label = 'Midnight Reverie'
        description = 'Quiet, shadowed, and emotionally suspended.'
        hex_color = '#46608f'
    elif energy < 0.45 and valence >= 0.52:
        label = 'Pastel Drift'
        description = 'Softly buoyant and dream-lit.'
        hex_color = '#c5b7ff'
    else:
        label = 'Bittersweet Orbit'
        description = 'Balanced between ache and motion.'
        hex_color = '#7c6fff'
    return {
        'label': label,
        'hex': hex_color,
        'description': description,
        'energy': round(energy, 3),
        'valence': round(valence, 3),
        'tempo': round(tempo, 1),
        'genres': genres or [],
    }


def generate_poetic_persona(genres: list[str], energy: float, valence: float, tempo: float) -> dict:
    personality = generate_personality(genres, energy, valence, tempo)
    personality['vibe'] = classify_vibe(energy, valence, tempo, genres)
    return personality


def extract_palette_from_features(
    average_valence: float,
    average_energy: float,
    genres: list[str] | None = None,
) -> dict:
    profile_input = _build_input({
        'genres': [{'genre': genre, 'count': 1} for genre in (genres or [])],
        'audioFeatures': {
            'energy': average_energy,
            'valence': average_valence,
        },
    })
    structure = _structure_signals(profile_input)
    scored = _normalize_scores([_score_category(category, profile_input, structure) for category in AESTHETIC_CATEGORIES])
    primary, secondary, _ = _top_blend(scored)
    palette = _generate_palette(primary, secondary)
    query = ' '.join((primary.get('palette_hints') or [])[:2] + (primary.get('visual_mood') or [])[:1]) or primary['label'].lower()
    return {
        'name': primary['label'],
        'palette': palette,
        'unsplash_query': query,
        'description': primary['short_description'],
        'energy': round(average_energy, 3),
        'valence': round(average_valence, 3),
        'genre_override': bool(genres),
    }


def build_aesthetic_report(data: dict, seed_offset: int = 0) -> dict:
    profile_input = _build_input(data)
    structure = _structure_signals(profile_input)
    scored = [_score_category(category, profile_input, structure) for category in AESTHETIC_CATEGORIES]
    scored = _normalize_scores(scored)

    primary, secondary, rejected = _top_blend(scored)
    confidence = compute_aesthetic_confidence(
        profile_input,
        {
            'era_years': structure['eraYears'],
            'artist_popularity_count': structure['artistPopularityCount'],
            'variance_features': structure['varianceFeatures'],
        },
    )
    support = _supporting_signals(primary, profile_input, structure, confidence)
    explanation = build_aesthetic_explanation(primary, secondary, support, confidence, rejected)
    palette = _generate_palette(primary, secondary)
    tags = _generate_tags(primary, secondary, support)
    audio = profile_input['audioFeatures']

    name_seed = f"{primary['id']}-{seed_offset}-{''.join(tag[:2] for tag in tags[:4])}"
    rng = random.Random(hash(name_seed) % (2 ** 32))
    blend_adjective = rng.choice(primary.get('palette_hints') or ['cosmic'])
    aesthetic_name = f"{primary['label']} {blend_adjective.title()}".strip()
    vibe_description = explanation['summary']

    personality = generate_personality(
        [item['genre'] for item in profile_input['genres'][:6]],
        audio.get('energy'),
        audio.get('valence'),
        audio.get('tempo'),
    )

    era_influence = _era_influence(structure)
    supporting_signals = {
        **support,
        'audioFeatureSpread': {
            key: _feature_variance(profile_input['audioFeaturesList'], key)
            for key in ['energy', 'valence', 'danceability', 'acousticness']
        },
        'discoveryScore': structure['discovery'],
        'diversityScore': structure['diversity'],
    }

    return {
        'primaryAesthetic': {
            'id': primary['id'],
            'label': primary['label'],
            'description': primary['short_description'],
            'weight': primary['weight'],
            'weightPct': primary['weightPct'],
        },
        'secondaryAesthetics': [
            {
                'id': item['id'],
                'label': item['label'],
                'description': item['short_description'],
                'weight': item['weight'],
                'weightPct': item['weightPct'],
            }
            for item in secondary
        ],
        'aestheticBlend': [
            {'id': item['id'], 'label': item['label'], 'weight': item['weight'], 'weightPct': item['weightPct']}
            for item in [primary] + secondary
        ],
        'confidence': confidence,
        'supportingSignals': supporting_signals,
        'rejectedCandidates': explanation['rejected'],
        'explanation': explanation['summary'],
        'blendExplanation': explanation['blendExplanation'],
        'paletteHints': explanation['paletteHints'],
        'textureHints': explanation['textureHints'],
        'motionHints': explanation['motionHints'],
        'visualMoodDescriptors': explanation['visualMoodDescriptors'],
        'culturalDescriptors': explanation['culturalDescriptors'],
        'eraInfluence': era_influence,
        'methodology': explanation['methodology'],
        'aesthetic_name': aesthetic_name,
        'palette': palette,
        'tags': tags,
        'vibe_description': vibe_description,
        'personality': personality,
        'images': [],
    }


# Backward-compatible wrappers used by existing routes.
def generate_aesthetic_name(genres: list[str], energy: float, valence: float, seed_offset: int = 0) -> str:
    report = build_aesthetic_report({
        'genres': [{'genre': genre, 'count': 1} for genre in genres],
        'audioFeatures': {'energy': energy, 'valence': valence},
    }, seed_offset)
    return report['aesthetic_name']


def generate_palette(genres: list[str], energy: float, valence: float) -> list[str]:
    return extract_palette_from_features(valence, energy, genres).get('palette', [])


def generate_vibe_description(genres: list[str], energy: float, valence: float) -> str:
    report = build_aesthetic_report({
        'genres': [{'genre': genre, 'count': 1} for genre in genres],
        'audioFeatures': {'energy': energy, 'valence': valence},
    })
    return report['vibe_description']


def generate_aesthetic_tags(
    genres: list[str],
    energy: float,
    valence: float,
    tempo: float,
    danceability: float = 0.5,
    top_artists: list[str] | None = None,
    personality_traits: list[str] | None = None,
    max_tags: int = 18,
) -> list[str]:
    report = build_aesthetic_report({
        'genres': [{'genre': genre, 'count': 1} for genre in genres],
        'audioFeatures': {
            'energy': energy,
            'valence': valence,
            'tempo': tempo,
            'danceability': danceability,
        },
        'topArtists': [{'name': artist} for artist in (top_artists or [])],
    })
    tags = report['tags'] + (personality_traits or [])
    return list(dict.fromkeys(tags))[:max_tags]

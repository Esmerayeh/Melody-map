"""
music_profile_builder.py
------------------------
Aggregates Spotify data into a single canonical music profile.
Called by the /api/music-profile endpoint.

Reliability rules for this builder:
- Top artists and top tracks always come from the same canonical Spotify window.
- Analytics and identity only use analyzable top tracks, never recent/saved fallbacks.
- Missing data stays missing; user-facing metrics return None instead of fake neutral values.
- Confidence and degraded-mode metadata travel with every major domain.
"""

from __future__ import annotations

from datetime import datetime, timezone
import math

import requests as req

PROFILE_SCHEMA_VERSION = '2026-03-profile-v2'
CANONICAL_TOP_LIMIT = 50
AUDIO_FEATURE_KEYS = [
    'energy',
    'valence',
    'danceability',
    'acousticness',
    'tempo',
    'speechiness',
    'instrumentalness',
    'loudness',
]

ANALYTICS_METHODS = {
    'energyScore': 'mean(spotify_audio_features.energy)',
    'valenceScore': 'mean(spotify_audio_features.valence)',
    'danceabilityScore': 'mean(spotify_audio_features.danceability)',
    'acousticnessScore': 'mean(spotify_audio_features.acousticness)',
    'tempoAvg': 'mean(spotify_audio_features.tempo)',
    'speechinessScore': 'mean(spotify_audio_features.speechiness)',
    'instrumentalScore': 'mean(spotify_audio_features.instrumentalness)',
    'nostalgiaIndex': 'normalized age of release years from canonical top tracks',
    'diversityScore': 'normalized genre entropy derived from canonical top artists',
    'sonicBrightness': '0.45*valence + 0.35*energy + 0.2*(1-acousticness)',
    'mood': 'threshold classification over aggregate energy and valence',
}

GENRE_AESTHETIC_MAP: dict[str, list[str]] = {
    'shoegaze': ['dreamcore', 'neon fog', 'blurred lights', 'hazy bokeh'],
    'dream pop': ['ethereal night', 'lavender haze', 'soft focus', 'pastel sky'],
    'indie rock': ['neon city', 'vintage film', 'polaroid', 'warm grain'],
    'jazz': ['smoky bar', 'amber night', 'noir photography', 'candlelit'],
    'electronic': ['cyberpunk', 'neon grid', 'synthwave', 'glitch art'],
    'hip hop': ['urban night', 'city skyline', 'golden hour', 'graffiti'],
    'r&b': ['velvet night', 'moody portrait', 'warm candlelight'],
    'classical': ['marble architecture', 'golden hour', 'baroque', 'misty forest'],
    'metal': ['dark forest', 'storm clouds', 'gothic architecture'],
    'pop': ['colorful neon', 'bubblegum', 'pastel room', 'bright lights'],
    'folk': ['autumn forest', 'cozy cabin', 'golden wheat', 'wildflower'],
    'ambient': ['deep ocean', 'starry night', 'aurora borealis', 'misty mountains'],
    'lo-fi': ['rainy window', 'cozy study', 'warm lamp', 'vintage cassette'],
    'indie pop': ['pastel aesthetic', 'soft sunlight', 'flower crown', 'dreamy portrait'],
    'alternative': ['moody landscape', 'overcast sky', 'film noir', 'abandoned building'],
    'synthwave': ['retro neon grid', 'purple sunset highway', 'chrome reflections'],
    'vaporwave': ['pastel glitch', 'retro computer', 'pink sunset mall'],
    'darkwave': ['gothic cathedral', 'moonlit ruins', 'velvet shadows'],
    'post-rock': ['vast landscape', 'cinematic horizon', 'long exposure sky'],
    'k-pop': ['pastel studio', 'colorful fashion', 'neon aesthetic'],
    'trap': ['neon city rain', 'dark moody portrait', 'luxury aesthetic'],
    'house': ['colorful rave', 'laser lights', 'neon dance floor'],
    'emo': ['rainy night', 'dark bedroom', 'melancholic portrait'],
}

_ENERGY_TAGS = {
    (0.7, 1.0): ['electric', 'kinetic', 'charged', 'vivid'],
    (0.4, 0.7): ['warm', 'flowing', 'amber', 'golden'],
    (0.0, 0.4): ['ethereal', 'misty', 'soft', 'hazy'],
}

_VALENCE_TAGS = {
    (0.65, 1.0): ['radiant', 'luminous', 'bloom', 'solstice'],
    (0.35, 0.65): ['bittersweet', 'dusk', 'twilight', 'liminal'],
    (0.0, 0.35): ['midnight', 'obsidian', 'shadow', 'void'],
}

GENRE_ARCHETYPE_HINTS = {
    'dreamy': ['shoegaze', 'dream pop', 'ambient', 'slowcore', 'post-rock'],
    'nostalgic': ['indie', 'folk', 'lo-fi', 'singer-songwriter'],
    'chaotic': ['hyperpop', 'edm', 'punk', 'metal', 'trap', 'drum and bass'],
    'romantic': ['r&b', 'soul', 'neo-soul', 'jazz'],
    'melancholic': ['emo', 'darkwave', 'sadcore', 'goth', 'slowcore'],
    'cosmic': ['ambient', 'electronic', 'synthwave', 'experimental', 'drone'],
}

ARCHETYPES = [
    {'id': 'dreamy', 'label': 'Dreamy', 'emoji': 'moon', 'color': '#a78bfa', 'description': 'Atmospheric, introspective, and beautifully hazy.'},
    {'id': 'nostalgic', 'label': 'Nostalgic', 'emoji': 'film', 'color': '#fbbf24', 'description': 'Warm memories wrapped in slow, organic sound.'},
    {'id': 'chaotic', 'label': 'Chaotic', 'emoji': 'bolt', 'color': '#ef4444', 'description': 'High-octane, unpredictable, and relentlessly intense.'},
    {'id': 'romantic', 'label': 'Romantic', 'emoji': 'rose', 'color': '#f472b6', 'description': 'Tender, emotional, and deeply soulful.'},
    {'id': 'melancholic', 'label': 'Melancholic', 'emoji': 'rain', 'color': '#60a5fa', 'description': 'Beautifully sad. You find meaning in the minor key.'},
    {'id': 'cosmic', 'label': 'Cosmic', 'emoji': 'orbital', 'color': '#34d399', 'description': 'Ambient, vast, and instrumental. Music as a universe.'},
]

MBTI_TYPES = {
    'INFP': {'name': 'The Dream Listener', 'desc': 'You live inside music. Emotional, introspective, and deeply personal.'},
    'INFJ': {'name': 'The Sonic Sage', 'desc': 'Rare and perceptive. You hear what others miss and build profound connections through sound.'},
    'INTP': {'name': 'The Frequency Analyst', 'desc': 'You deconstruct music intellectually. Patterns and sonic architecture fascinate you.'},
    'INTJ': {'name': 'The Architect of Sound', 'desc': 'Deliberate and visionary. Your taste is curated with precision and purpose.'},
    'ISFP': {'name': 'The Velvet Wanderer', 'desc': 'Sensory and present. You feel music in your body and let it guide your mood.'},
    'ISFJ': {'name': 'The Keeper of Melodies', 'desc': 'Loyal to your favorites. Comfort, warmth, and familiarity define your listening.'},
    'ISTP': {'name': 'The Sonic Craftsman', 'desc': 'Precise and understated. You appreciate technical mastery and raw authenticity.'},
    'ISTJ': {'name': 'The Faithful Curator', 'desc': 'Consistent and reliable. Your library is a well-organized archive of trusted sounds.'},
    'ENFP': {'name': 'The Eclectic Explorer', 'desc': 'Boundlessly curious. You jump genres, eras, and moods with enthusiasm.'},
    'ENFJ': {'name': 'The Communal Conductor', 'desc': 'Music is social for you. You curate for others and find joy in shared listening.'},
    'ENTP': {'name': 'The Genre Disruptor', 'desc': 'You challenge conventions and love music that breaks the mold.'},
    'ENTJ': {'name': 'The Sonic Commander', 'desc': 'Bold and decisive. Your playlist is a statement, not a suggestion.'},
    'ESFP': {'name': 'The Dance Floor Oracle', 'desc': 'Spontaneous and joyful. Music is movement, celebration, and presence.'},
    'ESFJ': {'name': 'The Crowd Pleaser', 'desc': 'Warm and inclusive. You love music that brings people together.'},
    'ESTP': {'name': 'The Adrenaline Chaser', 'desc': 'Fast, loud, and alive. You need music that matches your pace.'},
    'ESTJ': {'name': 'The Playlist Director', 'desc': 'Organized and purposeful. Every track has its place and time.'},
}


def _avg(items: list[dict], key: str) -> float | None:
    values = [float(item[key]) for item in items if item and item.get(key) is not None]
    return (sum(values) / len(values)) if values else None


def _count_present(items: list[dict], key: str) -> int:
    return sum(1 for item in items if item and item.get(key) is not None)


def _clamp(value: float | None, lo: float = 0.0, hi: float = 1.0) -> float | None:
    if value is None:
        return None
    return max(lo, min(hi, float(value)))


def _normalize_tempo(tempo: float | None) -> float | None:
    if tempo is None:
        return None
    return _clamp(tempo / 200.0)


def _weighted_average(parts: list[dict]) -> float | None:
    present = [part for part in parts if part.get('value') is not None and part.get('weight', 0) > 0]
    if not present:
        return None
    weight_sum = sum(part['weight'] for part in present) or 1.0
    return sum(part['value'] * part['weight'] for part in present) / weight_sum


def _confidence_from_ratio(ratio: float) -> dict:
    score = round(max(0.0, min(1.0, ratio)), 3)
    if score >= 0.8:
        label = 'high'
    elif score >= 0.5:
        label = 'medium'
    elif score > 0:
        label = 'low'
    else:
        label = 'unavailable'
    return {'score': score, 'label': label}


def _position_from_feature(value: float | None, spread: float) -> float:
    if value is None:
        return 0.0
    return (value - 0.5) * spread


def _derive_mood(energy: float | None, valence: float | None) -> str | None:
    if energy is None or valence is None:
        return None
    if energy > 0.7 and valence > 0.6:
        return 'euphoric'
    if energy > 0.7 and valence < 0.4:
        return 'intense'
    if energy > 0.7:
        return 'energetic'
    if energy < 0.35 and valence < 0.35:
        return 'melancholic'
    if energy < 0.35 and valence > 0.6:
        return 'serene'
    if energy < 0.35:
        return 'dreamy'
    if valence > 0.65:
        return 'uplifting'
    if valence < 0.35:
        return 'brooding'
    return 'balanced'


def _nostalgia_index(tracks: list[dict]) -> float | None:
    current_year = datetime.now(timezone.utc).year
    years = []
    for track in tracks:
        release_date = track.get('release_date') or ''
        if len(release_date) < 4:
            continue
        try:
            years.append(int(release_date[:4]))
        except ValueError:
            continue
    if not years:
        return None
    avg_year = sum(years) / len(years)
    return round(min(1.0, max(0.0, (current_year - avg_year) / (current_year - 1970))), 3)


def _extract_genres(artists: list[dict]) -> list[dict]:
    counts: dict[str, float] = {}
    total_artists = max(len(artists), 1)
    for index, artist in enumerate(artists):
        rank_weight = 1 - (index / max(total_artists, 1)) * 0.5
        popularity_weight = ((artist.get('popularity') or 0) / 100.0) * 0.15
        weight = round(rank_weight + popularity_weight, 3)
        for genre in (artist.get('genres') or []):
            key = genre.lower().strip()
            if not key:
                continue
            counts[key] = round(counts.get(key, 0.0) + weight, 3)

    sorted_items = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return [{'genre': genre, 'count': round(weight, 3)} for genre, weight in sorted_items]


def _build_aesthetic_tags(genres: list[dict], energy: float | None, valence: float | None) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for genre_item in genres[:4]:
        for tag in GENRE_AESTHETIC_MAP.get(genre_item['genre'], []):
            if tag not in seen:
                seen.add(tag)
                tags.append(tag)

    if energy is not None:
        for (lo, hi), group in _ENERGY_TAGS.items():
            if lo <= energy < hi:
                for tag in group[:2]:
                    if tag not in seen:
                        seen.add(tag)
                        tags.append(tag)
                break

    if valence is not None:
        for (lo, hi), group in _VALENCE_TAGS.items():
            if lo <= valence < hi:
                for tag in group[:2]:
                    if tag not in seen:
                        seen.add(tag)
                        tags.append(tag)
                break

    return tags[:16]


def _genre_text(genres: list[dict]) -> str:
    return ' '.join((genre.get('genre') or '') for genre in genres).lower()


def _genre_bonus(genres: list[dict], archetype_id: str) -> float:
    genre_text = _genre_text(genres)
    if not genre_text:
        return 0.0
    hints = GENRE_ARCHETYPE_HINTS.get(archetype_id, [])
    hits = sum(1 for hint in hints if hint in genre_text)
    return min(1.0, hits / max(len(hints), 1))


def _score_personality_archetypes(audio_features: dict, genres: list[dict]) -> dict:
    present_audio_keys = [
        key for key in ['energy', 'valence', 'danceability', 'acousticness', 'tempo', 'instrumentalness']
        if audio_features.get(key) is not None
    ]
    has_audio_signals = bool(present_audio_keys)
    has_genre_signals = bool(genres)
    missing_inputs = [
        key for key in ['energy', 'valence', 'danceability', 'acousticness', 'tempo', 'instrumentalness']
        if audio_features.get(key) is None
    ]

    if not has_audio_signals and not has_genre_signals:
        return {
            'traits': None,
            'confidence': 0.0,
            'missingInputs': missing_inputs,
            'inputsUsed': [],
            'methodology': 'music-personality-archetypes-v1',
        }

    energy = _clamp(audio_features.get('energy'))
    valence = _clamp(audio_features.get('valence'))
    acousticness = _clamp(audio_features.get('acousticness'))
    instrumentalness = _clamp(audio_features.get('instrumentalness'))
    tempo = audio_features.get('tempo')

    def archetype_score(archetype_id: str) -> float | None:
        if archetype_id == 'dreamy':
            return _weighted_average([
                {'value': acousticness, 'weight': 0.5},
                {'value': valence * (1 - abs(valence - 0.55)) if valence is not None else None, 'weight': 0.3},
                {'value': (1 - energy) if energy is not None else None, 'weight': 0.2},
            ])
        if archetype_id == 'nostalgic':
            normalized_tempo = _normalize_tempo(tempo)
            return _weighted_average([
                {'value': (1 - normalized_tempo) if normalized_tempo is not None else None, 'weight': 0.55},
                {'value': acousticness, 'weight': 0.45},
            ])
        if archetype_id == 'chaotic':
            return _weighted_average([
                {'value': energy, 'weight': 0.55},
                {'value': _normalize_tempo(tempo), 'weight': 0.45},
            ])
        if archetype_id == 'romantic':
            return _weighted_average([
                {'value': valence, 'weight': 0.45},
                {'value': acousticness, 'weight': 0.35},
                {'value': (1 - energy) if energy is not None else None, 'weight': 0.2},
            ])
        if archetype_id == 'melancholic':
            return _weighted_average([
                {'value': (1 - valence) if valence is not None else None, 'weight': 0.65},
                {'value': (1 - energy) if energy is not None else None, 'weight': 0.35},
            ])
        if archetype_id == 'cosmic':
            return _weighted_average([
                {'value': instrumentalness, 'weight': 0.5},
                {'value': acousticness, 'weight': 0.3},
                {'value': (1 - energy) if energy is not None else None, 'weight': 0.2},
            ])
        return None

    raw_scores = []
    for archetype in ARCHETYPES:
        audio_score = archetype_score(archetype['id']) if has_audio_signals else None
        genre_score = _genre_bonus(genres, archetype['id']) if has_genre_signals else None
        blended = _weighted_average([
            {'value': audio_score, 'weight': 0.75 if has_audio_signals else 0.0},
            {'value': genre_score, 'weight': 0.25 if has_genre_signals else 0.0},
        ])
        raw_scores.append({**archetype, 'raw': blended or 0.0})

    total = sum(item['raw'] for item in raw_scores) or 1.0
    scored = [{**item, 'pct': round((item['raw'] / total) * 100)} for item in sorted(raw_scores, key=lambda item: item['raw'], reverse=True)]
    confidence = min(1.0, (len(present_audio_keys) / 6.0) * 0.8 + (0.2 if has_genre_signals else 0.0)) if has_audio_signals else min(0.45, len(genres) / 12.0)

    return {
        'traits': scored[:3],
        'confidence': round(confidence, 3),
        'missingInputs': missing_inputs,
        'inputsUsed': present_audio_keys + (['genres'] if has_genre_signals else []),
        'methodology': 'music-personality-archetypes-v1',
    }


def _compute_mbti(audio_features: dict, genres: list[dict], artists: list[dict]) -> dict:
    input_keys = ['acousticness', 'danceability', 'instrumentalness', 'valence']
    available_audio = [key for key in input_keys if audio_features.get(key) is not None]
    popularities = [artist.get('popularity') / 100.0 for artist in artists if artist.get('popularity') is not None]

    if len(available_audio) < len(input_keys) or not genres or not artists or not popularities:
        missing = [key for key in input_keys if audio_features.get(key) is None]
        if not genres:
            missing.append('genres')
        if not artists:
            missing.append('topArtists')
        if not popularities:
            missing.append('artistPopularity')
        return {
            'value': None,
            'confidence': 0.0,
            'missingInputs': missing,
            'inputsUsed': available_audio,
            'methodology': 'music-mbti-v1',
        }

    ie = _clamp(audio_features.get('acousticness')) * 0.5 + (1 - _clamp(audio_features.get('danceability'))) * 0.5
    is_introvert = ie > 0.5
    unique_genres = len({genre.get('genre') for genre in genres if genre.get('genre')})
    genre_diversity = min(unique_genres / 15.0, 1.0)
    is_intuition = genre_diversity > 0.5
    tf = _clamp(audio_features.get('instrumentalness')) * 0.5 + (1 - _clamp(audio_features.get('valence'))) * 0.5
    is_thinking = tf > 0.5
    avg_popularity = sum(popularities) / len(popularities)
    spread = math.sqrt(sum((value - avg_popularity) ** 2 for value in popularities) / len(popularities))
    is_perceiving = spread > 0.25
    mbti_type = f'{"I" if is_introvert else "E"}{"N" if is_intuition else "S"}{"T" if is_thinking else "F"}{"P" if is_perceiving else "J"}'
    meta = MBTI_TYPES.get(mbti_type, {'name': 'The Sonic Explorer', 'desc': 'Your taste defies easy categorization.'})
    confidence = min(1.0, (len(available_audio) / len(input_keys)) * 0.7 + min(1.0, len(genres) / 12.0) * 0.15 + min(1.0, len(artists) / 50.0) * 0.15)

    return {
        'value': {
            'type': mbti_type,
            'name': meta['name'],
            'desc': meta['desc'],
            'axes': {
                'IE': {'label': 'Introvert' if is_introvert else 'Extravert', 'score': round(ie * 100), 'flipped': not is_introvert},
                'NS': {'label': 'Intuition' if is_intuition else 'Sensing', 'score': round(genre_diversity * 100), 'flipped': not is_intuition},
                'TF': {'label': 'Thinking' if is_thinking else 'Feeling', 'score': round(tf * 100), 'flipped': not is_thinking},
                'JP': {'label': 'Perceiving' if is_perceiving else 'Judging', 'score': round(spread * 200), 'flipped': not is_perceiving},
            },
        },
        'confidence': round(confidence, 3),
        'missingInputs': [key for key in input_keys if audio_features.get(key) is None],
        'inputsUsed': available_audio + ['genres', 'topArtists'],
        'methodology': 'music-mbti-v1',
    }


def _hsl_from_genre(genre: str) -> str:
    hue = abs(hash(genre)) % 360
    return f'hsl({hue}, 70%, 55%)'


def _sonic_color(energy: float | None, valence: float | None) -> str:
    if energy is None or valence is None:
        return 'hsl(220, 45%, 58%)'
    hue = round(valence * 260)
    sat = round(55 + energy * 30)
    lit = round(42 + valence * 18)
    return f'hsl({hue}, {sat}%, {lit}%)'


def _build_galaxy_nodes(artists: list[dict], genres: list[dict], audio_features: dict) -> list[dict]:
    nodes: list[dict] = []
    energy = audio_features.get('energy')
    valence = audio_features.get('valence')
    danceability = audio_features.get('danceability')
    spread = 10.0
    top_genres = genres[:12]
    genre_node_ids: dict[str, str] = {}
    top_genre_weight = top_genres[0]['count'] if top_genres else 1.0

    for index, genre_item in enumerate(top_genres):
        genre_id = f'genre_{genre_item["genre"].replace(" ", "_")}'
        angle = (index / max(len(top_genres), 1)) * 2 * math.pi
        radius = 6 + (genre_item['count'] / max(top_genre_weight, 1.0)) * 4
        nodes.append({
            'id': genre_id,
            'label': genre_item['genre'],
            'type': 'genre',
            'genre': genre_item['genre'],
            'genres': [genre_item['genre']],
            'size': round(0.4 + (genre_item['count'] / max(top_genre_weight, 1.0)) * 0.8, 3),
            'color': _hsl_from_genre(genre_item['genre']),
            'x': round(radius * math.cos(angle), 2),
            'y': round(_position_from_feature(energy, spread * 0.5), 2),
            'z': round(radius * math.sin(angle), 2),
            'connections': [],
            'count': genre_item['count'],
        })
        genre_node_ids[genre_item['genre']] = genre_id

    nodes_by_id = {node['id']: node for node in nodes}
    for index, artist in enumerate(artists[:30]):
        artist_id = f'artist_{artist.get("id", index)}'
        raw_popularity = artist.get('popularity')
        normalized_popularity = (raw_popularity / 100.0) if raw_popularity is not None else 0.0
        artist_genres = artist.get('genres') or []
        primary_genre = artist_genres[0] if artist_genres else None

        if primary_genre and primary_genre in genre_node_ids:
            genre_node = nodes_by_id.get(genre_node_ids[primary_genre])
            jitter = (normalized_popularity - 0.5) * 3 if raw_popularity is not None else ((index % 5) - 2) * 0.4
            x = genre_node['x'] + jitter
            y = genre_node['y'] + ((normalized_popularity - 0.5) * 2 if raw_popularity is not None else 0.0)
            z = genre_node['z'] + jitter * 0.7
        else:
            x = _position_from_feature(valence, spread) + ((index % 5) - 2) * 1.5
            y = _position_from_feature(energy, spread)
            z = _position_from_feature(danceability, spread) + ((index % 3) - 1) * 1.5

        node = {
            'id': artist_id,
            'label': artist.get('name', 'Unknown'),
            'type': 'artist',
            'genre': primary_genre or '',
            'genres': artist_genres,
            'size': round(0.3 + normalized_popularity * 0.9, 3) if raw_popularity is not None else 0.45,
            'color': _sonic_color(energy, valence),
            'image': artist.get('image'),
            'x': round(x, 2),
            'y': round(y, 2),
            'z': round(z, 2),
            'connections': [],
            'popularity': raw_popularity,
            'spotify_url': artist.get('spotify_url'),
        }
        if primary_genre and primary_genre in genre_node_ids:
            node['connections'].append(genre_node_ids[primary_genre])
            nodes_by_id[genre_node_ids[primary_genre]]['connections'].append(artist_id)
        nodes.append(node)

    genre_keys = list(genre_node_ids.values())
    for index in range(len(genre_keys) - 1):
        nodes_by_id[genre_keys[index]]['connections'].append(genre_keys[index + 1])

    return nodes


def _build_analytics(genres: list[dict], audio_features: dict, tracks: list[dict]) -> dict:
    energy = audio_features.get('energy')
    valence = audio_features.get('valence')
    danceability = audio_features.get('danceability')
    acousticness = audio_features.get('acousticness')
    tempo = audio_features.get('tempo')
    speechiness = audio_features.get('speechiness')
    instrumentalness = audio_features.get('instrumentalness')
    total_weight = sum(genre.get('count', 0) for genre in genres) or 0

    entropy = 0.0
    if total_weight > 0:
        for genre in genres:
            probability = genre['count'] / total_weight
            if probability > 0:
                entropy -= probability * math.log2(probability)
    max_entropy = math.log2(len(genres)) if len(genres) > 1 else 1.0
    diversity = round(min(1.0, entropy / max_entropy) * 100) if genres else None

    brightness = None
    if energy is not None and valence is not None and acousticness is not None:
        brightness = round((valence * 0.45 + energy * 0.35 + (1 - acousticness) * 0.2) * 100)

    nostalgia_raw = _nostalgia_index(tracks)
    nostalgia = round(nostalgia_raw * 100) if nostalgia_raw is not None else None

    return {
        'mood': _derive_mood(energy, valence),
        'energyScore': round(energy * 100) if energy is not None else None,
        'valenceScore': round(valence * 100) if valence is not None else None,
        'danceabilityScore': round(danceability * 100) if danceability is not None else None,
        'acousticnessScore': round(acousticness * 100) if acousticness is not None else None,
        'tempoAvg': round(tempo) if tempo is not None else None,
        'speechinessScore': round(speechiness * 100) if speechiness is not None else None,
        'instrumentalScore': round(instrumentalness * 100) if instrumentalness is not None else None,
        'nostalgiaIndex': nostalgia,
        'diversityScore': diversity,
        'sonicBrightness': brightness,
    }


def _build_metric_metadata(audio_features_list: list[dict], requested_track_count: int, genres: list[dict], analytics: dict, tracks: list[dict]) -> dict:
    feature_map = {
        'energy': 'energyScore',
        'valence': 'valenceScore',
        'danceability': 'danceabilityScore',
        'acousticness': 'acousticnessScore',
        'tempo': 'tempoAvg',
        'speechiness': 'speechinessScore',
        'instrumentalness': 'instrumentalScore',
    }
    sample_sizes = {}
    feature_coverage = {}
    metric_confidence = {}

    for feature_key, metric_key in feature_map.items():
        present = _count_present(audio_features_list, feature_key)
        ratio = (present / requested_track_count) if requested_track_count else 0.0
        sample_sizes[metric_key] = present
        feature_coverage[feature_key] = {'count': present, 'requested': requested_track_count, 'ratio': round(ratio, 3)}
        metric_confidence[metric_key] = {
            **_confidence_from_ratio(ratio),
            'sampleSize': present,
            'requested': requested_track_count,
            'method': ANALYTICS_METHODS[metric_key],
        }

    genre_weight_total = sum(genre.get('count', 0) for genre in genres)
    genre_ratio = min(1.0, genre_weight_total / max(len(tracks), 1)) if tracks and genre_weight_total else 0.0
    sample_sizes['diversityScore'] = len(genres)
    metric_confidence['diversityScore'] = {
        **_confidence_from_ratio(genre_ratio),
        'sampleSize': len(genres),
        'requested': max(len(tracks), 1),
        'method': ANALYTICS_METHODS['diversityScore'],
    }

    years_available = sum(1 for track in tracks if (track.get('release_date') or '')[:4].isdigit())
    year_ratio = years_available / max(len(tracks), 1) if tracks else 0.0
    sample_sizes['nostalgiaIndex'] = years_available
    metric_confidence['nostalgiaIndex'] = {
        **_confidence_from_ratio(year_ratio),
        'sampleSize': years_available,
        'requested': len(tracks),
        'method': ANALYTICS_METHODS['nostalgiaIndex'],
    }

    mood_sources = min(sample_sizes.get('energyScore', 0), sample_sizes.get('valenceScore', 0))
    mood_ratio = mood_sources / max(requested_track_count, 1) if requested_track_count else 0.0
    sample_sizes['mood'] = mood_sources
    metric_confidence['mood'] = {
        **_confidence_from_ratio(mood_ratio),
        'sampleSize': mood_sources,
        'requested': requested_track_count,
        'method': ANALYTICS_METHODS['mood'],
    }

    brightness_sources = min(sample_sizes.get('energyScore', 0), sample_sizes.get('valenceScore', 0), sample_sizes.get('acousticnessScore', 0))
    brightness_ratio = brightness_sources / max(requested_track_count, 1) if requested_track_count else 0.0
    sample_sizes['sonicBrightness'] = brightness_sources
    metric_confidence['sonicBrightness'] = {
        **_confidence_from_ratio(brightness_ratio),
        'sampleSize': brightness_sources,
        'requested': requested_track_count,
        'method': ANALYTICS_METHODS['sonicBrightness'],
    }

    analytics['sampleSizes'] = sample_sizes
    analytics['metricConfidence'] = metric_confidence
    analytics['featureCoverageByMetric'] = feature_coverage
    analytics['methodology'] = ANALYTICS_METHODS
    return analytics


def _normalize_artist(item: dict) -> dict:
    return {
        'id': item.get('id'),
        'name': item.get('name'),
        'genres': item.get('genres') or [],
        'popularity': item.get('popularity'),
        'image': item['images'][0]['url'] if item.get('images') else None,
        'spotify_url': item.get('external_urls', {}).get('spotify'),
    }


def _normalize_track(item: dict) -> dict:
    return {
        'id': item.get('id'),
        'title': item.get('name'),
        'artist': item['artists'][0]['name'] if item.get('artists') else '',
        'artists': [artist['name'] for artist in item.get('artists', [])],
        'album': item.get('album', {}).get('name', ''),
        'album_art': item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
        'popularity': item.get('popularity'),
        'release_date': item.get('album', {}).get('release_date', ''),
        'spotify_url': item.get('external_urls', {}).get('spotify'),
    }


def _build_domain_confidence(audio_coverage: float, top_artists_count: int, top_tracks_count: int, genres_count: int, personality_meta: dict, mbti_meta: dict) -> dict:
    artist_ratio = min(1.0, top_artists_count / CANONICAL_TOP_LIMIT)
    track_ratio = min(1.0, top_tracks_count / CANONICAL_TOP_LIMIT)
    genre_ratio = min(1.0, genres_count / 12.0)
    analytics_score = min(1.0, audio_coverage * 0.8 + track_ratio * 0.2)
    identity_score = min(1.0, (personality_meta.get('confidence', 0.0) * 0.65) + (genre_ratio * 0.2) + (artist_ratio * 0.15))
    galaxy_score = min(1.0, artist_ratio * 0.65 + genre_ratio * 0.35)
    audio_presence = 1.0 if audio_coverage > 0 else 0.0
    soulmate_score = min(1.0, artist_ratio * 0.35 + genre_ratio * 0.2 + track_ratio * 0.15 + audio_coverage * 0.2 + audio_presence * 0.1)
    mbti_score = mbti_meta.get('confidence', 0.0)
    overall_score = (analytics_score + identity_score + galaxy_score + soulmate_score) / 4.0
    return {
        'analytics': _confidence_from_ratio(analytics_score),
        'identity': _confidence_from_ratio(identity_score),
        'galaxy': _confidence_from_ratio(galaxy_score),
        'soulmate': _confidence_from_ratio(soulmate_score),
        'mbti': _confidence_from_ratio(mbti_score),
        'overall': _confidence_from_ratio(overall_score),
    }


def build_music_profile(spotify_token: str, time_range: str = 'medium_term', limit: int = 50) -> dict:
    """
    Fetch Spotify data and build a complete canonical music profile.
    """
    spotify_root = 'https://api.spotify.com/v1'
    requested_limit = min(max(int(limit), 1), CANONICAL_TOP_LIMIT)
    now_iso = datetime.now(timezone.utc).isoformat()
    headers = {'Authorization': f'Bearer {spotify_token}'}

    def _get(path: str, params: dict | None = None) -> dict:
        try:
            response = req.get(f'{spotify_root}{path}', headers=headers, params=params, timeout=10)
            if response.status_code == 401:
                return {}
            response.raise_for_status()
            return response.json()
        except Exception:
            return {}

    user_profile_raw = _get('/me')
    top_artists_raw = _get('/me/top/artists', {'limit': requested_limit, 'time_range': time_range})
    top_tracks_raw = _get('/me/top/tracks', {'limit': requested_limit, 'time_range': time_range})
    recently_played_raw = _get('/me/player/recently-played', {'limit': 50})
    saved_tracks_raw = _get('/me/tracks', {'limit': 50})

    top_artists = [_normalize_artist(item) for item in (top_artists_raw.get('items') or []) if item]
    top_tracks = [_normalize_track(item) for item in (top_tracks_raw.get('items') or []) if item]

    recent_tracks = []
    seen_ids: set[str] = {track['id'] for track in top_tracks if track.get('id')}
    for entry in (recently_played_raw.get('items') or []):
        item = entry.get('track') if isinstance(entry, dict) and 'track' in entry else entry
        if not item or not item.get('id') or item['id'] in seen_ids:
            continue
        seen_ids.add(item['id'])
        recent_tracks.append({
            'id': item.get('id'),
            'title': item.get('name'),
            'artist': item['artists'][0]['name'] if item.get('artists') else '',
            'album_art': item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
            'popularity': item.get('popularity'),
            'release_date': item.get('album', {}).get('release_date', ''),
        })

    saved_tracks = []
    for entry in (saved_tracks_raw.get('items') or []):
        item = entry.get('track') if isinstance(entry, dict) and 'track' in entry else entry
        if not item or not item.get('id'):
            continue
        saved_tracks.append({
            'id': item.get('id'),
            'title': item.get('name'),
            'artist': item['artists'][0]['name'] if item.get('artists') else '',
            'album_art': item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
            'popularity': item.get('popularity'),
            'release_date': item.get('album', {}).get('release_date', ''),
        })

    canonical_track_ids = [track['id'] for track in top_tracks if track.get('id')][:CANONICAL_TOP_LIMIT]
    audio_features_list: list[dict] = []
    if canonical_track_ids:
        try:
            response = req.get(
                f'{spotify_root}/audio-features',
                headers=headers,
                params={'ids': ','.join(canonical_track_ids)},
                timeout=10,
            )
            if response.ok:
                for feature_row in (response.json().get('audio_features') or []):
                    if not feature_row:
                        continue
                    audio_features_list.append({
                        'id': feature_row.get('id'),
                        'energy': feature_row.get('energy'),
                        'valence': feature_row.get('valence'),
                        'danceability': feature_row.get('danceability'),
                        'acousticness': feature_row.get('acousticness'),
                        'instrumentalness': feature_row.get('instrumentalness'),
                        'speechiness': feature_row.get('speechiness'),
                        'tempo': feature_row.get('tempo'),
                        'loudness': feature_row.get('loudness'),
                    })
        except Exception:
            pass

    average_audio_features = {}
    for key in AUDIO_FEATURE_KEYS:
        average = _avg(audio_features_list, key)
        average_audio_features[key] = round(average, 4) if average is not None else None

    features_by_track_id = {row['id']: row for row in audio_features_list if row.get('id')}
    for track in top_tracks:
        track['audio_features'] = features_by_track_id.get(track.get('id'))

    genres = _extract_genres(top_artists)
    analytics = _build_analytics(genres, average_audio_features, top_tracks)
    analytics = _build_metric_metadata(audio_features_list, len(canonical_track_ids), genres, analytics, top_tracks)
    personality_meta = _score_personality_archetypes(average_audio_features, genres)
    mbti_meta = _compute_mbti(average_audio_features, genres, top_artists)
    audio_coverage = round(len(audio_features_list) / len(canonical_track_ids), 3) if canonical_track_ids else 0.0
    confidence = _build_domain_confidence(audio_coverage, len(top_artists), len(top_tracks), len(genres), personality_meta, mbti_meta)
    feature_coverage_by_metric = {
        key: {
            'count': _count_present(audio_features_list, key),
            'requested': len(canonical_track_ids),
            'ratio': round((_count_present(audio_features_list, key) / len(canonical_track_ids)), 3) if canonical_track_ids else 0.0,
        }
        for key in AUDIO_FEATURE_KEYS
    }

    degraded_reasons = []
    if len(top_artists) < requested_limit:
        degraded_reasons.append('top_artists_below_requested_limit')
    if len(top_tracks) < requested_limit:
        degraded_reasons.append('top_tracks_below_requested_limit')
    if audio_coverage == 0:
        degraded_reasons.append('spotify_audio_features_unavailable')
    elif audio_coverage < 0.6:
        degraded_reasons.append('spotify_audio_feature_coverage_low')
    if not genres:
        degraded_reasons.append('genre_extraction_unavailable')
    if not personality_meta.get('traits'):
        degraded_reasons.append('identity_inputs_missing')
    elif confidence['identity']['score'] < 0.5:
        degraded_reasons.append('identity_confidence_low')
    if mbti_meta.get('value') is None:
        degraded_reasons.append('mbti_inputs_missing')

    analytics_readiness = {
        'ready': confidence['analytics']['score'] >= 0.35,
        'confidence': confidence['analytics'],
        'reasons': [] if confidence['analytics']['score'] >= 0.35 else ['insufficient_audio_feature_coverage'],
    }
    identity_readiness = {
        'ready': bool(personality_meta.get('traits')) and confidence['identity']['score'] >= 0.2,
        'confidence': confidence['identity'],
        'mbtiReady': mbti_meta.get('value') is not None and confidence['mbti']['score'] >= 0.35,
        'reasons': [] if (bool(personality_meta.get('traits')) and confidence['identity']['score'] >= 0.2) else ['insufficient_identity_inputs'],
    }
    soulmate_readiness = {
        'ready': confidence['soulmate']['score'] >= 0.35 and len(top_artists) >= 10 and len(top_tracks) >= 10,
        'confidence': confidence['soulmate'],
        'mode': 'full' if audio_coverage >= 0.35 else 'degraded',
        'reasons': [] if (confidence['soulmate']['score'] >= 0.35 and len(top_artists) >= 10 and len(top_tracks) >= 10) else ['insufficient_overlap_inputs'],
        'weights': {'artists': 0.40, 'genres': 0.25, 'audio': 0.20, 'tracks': 0.10, 'vibe': 0.05},
    }

    data_quality = {
        'provider': 'spotify',
        'requestedLimit': requested_limit,
        'canonicalTrackWindow': requested_limit,
        'topArtistsCount': len(top_artists),
        'topTracksCount': len(top_tracks),
        'genresCount': len(genres),
        'audioFeaturesRequested': len(canonical_track_ids),
        'audioFeaturesCount': len(audio_features_list),
        'audioCoverage': audio_coverage,
        'hasAudioProfile': len(audio_features_list) > 0,
        'degradedReasons': degraded_reasons,
        'sampleSizes': analytics.get('sampleSizes', {}),
        'featureCoverageByMetric': feature_coverage_by_metric,
        'confidence': confidence,
    }

    galaxy_nodes = _build_galaxy_nodes(top_artists, genres, average_audio_features)
    aesthetic_tags = _build_aesthetic_tags(genres, average_audio_features.get('energy'), average_audio_features.get('valence'))
    images = user_profile_raw.get('images') or []
    user_profile = {
        'id': user_profile_raw.get('id'),
        'name': user_profile_raw.get('display_name'),
        'email': user_profile_raw.get('email'),
        'image': images[0]['url'] if images else None,
        'country': user_profile_raw.get('country'),
        'product': user_profile_raw.get('product'),
        'followers': user_profile_raw.get('followers', {}).get('total', 0),
    } if user_profile_raw else {}

    return {
        'profileSchemaVersion': PROFILE_SCHEMA_VERSION,
        'provider': 'spotify',
        'generatedAt': now_iso,
        'syncedAt': now_iso,
        'userProfile': user_profile,
        'topArtists': top_artists,
        'topTracks': top_tracks,
        'recentlyPlayed': recent_tracks[:25],
        'savedTracks': saved_tracks[:25],
        'audioFeatures': average_audio_features,
        'audioFeaturesList': audio_features_list,
        'analyticsMetrics': analytics,
        'personality': personality_meta.get('traits'),
        'personalityMeta': personality_meta,
        'mbti': mbti_meta.get('value'),
        'mbtiMeta': mbti_meta,
        'galaxyNodes': galaxy_nodes,
        'aestheticTags': aesthetic_tags,
        'genres': genres,
        'timeRange': time_range,
        'dataQuality': data_quality,
        'confidence': confidence,
        'analyticsReadiness': analytics_readiness,
        'identityReadiness': identity_readiness,
        'soulmateReadiness': soulmate_readiness,
    }

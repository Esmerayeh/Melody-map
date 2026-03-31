from __future__ import annotations

from dataclasses import dataclass
import re
from difflib import SequenceMatcher


AUDIO_KEYS = [
    'energy',
    'valence',
    'danceability',
    'acousticness',
    'instrumentalness',
    'speechiness',
    'tempo',
    'liveness',
]

EMOTIONAL_AUDIO_KEYS = [
    'energy',
    'valence',
    'danceability',
    'acousticness',
    'instrumentalness',
    'tempo',
]

SAME_AXIS_WEIGHT = 1.0
ADJACENT_AXIS_WEIGHT = 0.8
CONTRAST_AXIS_WEIGHT = 0.55

MBTI_COMPLEMENTS = {
    ('INFP', 'INFJ'),
    ('INFJ', 'ENFP'),
    ('INFP', 'ENFJ'),
    ('INTP', 'INFJ'),
    ('INTJ', 'ENFP'),
    ('ISFP', 'INFJ'),
}

GENRE_NEIGHBORS = {
    'shoegaze': {'dream pop', 'slowcore', 'post-rock', 'indie rock'},
    'dream pop': {'shoegaze', 'indie pop', 'ambient', 'slowcore'},
    'slowcore': {'shoegaze', 'dream pop', 'sadcore', 'folk'},
    'indie folk': {'folk', 'singer-songwriter', 'indie', 'slowcore'},
    'indie': {'indie rock', 'indie pop', 'indie folk', 'alternative'},
    'alternative': {'indie', 'alternative rock', 'dream pop', 'shoegaze'},
    'ambient': {'drone', 'electronic', 'post-rock', 'dream pop'},
    'electronic': {'ambient', 'synthwave', 'house', 'indietronica'},
    'folk': {'indie folk', 'singer-songwriter', 'americana', 'acoustic'},
    'singer-songwriter': {'folk', 'indie folk', 'acoustic', 'alternative'},
    'hip hop': {'rap', 'trap', 'alternative hip hop', 'neo-soul'},
    'rap': {'hip hop', 'trap', 'alternative hip hop'},
    'trap': {'hip hop', 'rap', 'electronic'},
    'r&b': {'neo-soul', 'soul', 'pop', 'jazz'},
    'neo-soul': {'r&b', 'soul', 'jazz'},
    'jazz': {'neo-soul', 'r&b', 'soul', 'ambient'},
    'metal': {'post-metal', 'punk', 'alternative metal'},
    'punk': {'metal', 'emo', 'alternative'},
    'emo': {'punk', 'sadcore', 'indie'},
}

TENSION_TRAIT_PAIRS = [
    ('dreamy', 'structured'),
    ('nostalgic', 'exploratory'),
    ('lyrical', 'textural'),
    ('introspective', 'social'),
    ('atmospheric', 'direct'),
    ('melancholic', 'radiant'),
]

RELATIONSHIP_ARCHETYPES = [
    {
        'id': 'rare_alignment',
        'title': 'Rare Alignment',
        'summary': 'A near-mirrored pairing with unusual emotional clarity.',
        'when': lambda metrics: metrics['overallCompatibility'] >= 88 and metrics['emotionalCompatibility'] >= 84 and metrics['discoveryCompatibility'] >= 56,
    },
    {
        'id': 'twin_dreamers',
        'title': 'Twin Dreamers',
        'summary': 'You meet in haze, inwardness, and beautifully blurred feeling.',
        'when': lambda metrics: metrics['mbtiCompatibility'] >= 80 and metrics['artistOverlapScore'] >= 52 and metrics['tensionScore'] < 52,
    },
    {
        'id': 'midnight_orbit',
        'title': 'Midnight Orbit',
        'summary': 'A deep emotional lock with enough difference to keep the night moving.',
        'when': lambda metrics: metrics['emotionalCompatibility'] >= 78 and 45 <= metrics['tensionScore'] <= 72,
    },
    {
        'id': 'magnetic_contrast',
        'title': 'Magnetic Contrast',
        'summary': 'You are not the same signal, but you intensify each other.',
        'when': lambda metrics: metrics['discoveryCompatibility'] >= 70 and metrics['tensionScore'] >= 66,
    },
    {
        'id': 'silver_echoes',
        'title': 'Silver Echoes',
        'summary': 'The overlap is subtle, but the emotional reflections run deep.',
        'when': lambda metrics: metrics['emotionalCompatibility'] >= 70 and metrics['artistOverlapScore'] < 38 and metrics['genreOverlapScore'] < 46,
    },
]


@dataclass
class ScoreResult:
    score: int
    confidence_weight: float
    details: dict


def clamp(value: float | int | None, lo: float = 0.0, hi: float = 1.0) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, numeric))


def normalize_score(value: float | None) -> int:
    if value is None:
        return 0
    return int(round(max(0.0, min(100.0, value))))


def confidence_label(score: float) -> str:
    if score >= 0.8:
        return 'high'
    if score >= 0.5:
        return 'medium'
    if score > 0:
        return 'low'
    return 'limited'


def slugify(value: str | None) -> str:
    return re.sub(r'\s+', ' ', str(value or '').strip().lower())


def display_name(item: dict | str | None, *keys: str) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for key in keys:
            raw = item.get(key)
            if raw:
                return str(raw).strip()
    return ''


def normalize_name_set(items: list[dict | str] | None, *keys: str) -> tuple[dict[str, str], list[str]]:
    mapping: dict[str, str] = {}
    ordered: list[str] = []
    for item in items or []:
        label = display_name(item, *keys)
        if not label:
            continue
        slug = slugify(label)
        if slug in mapping:
            continue
        mapping[slug] = label
        ordered.append(slug)
    return mapping, ordered


def tokenize(value: str | None) -> set[str]:
    return {
        token for token in re.split(r'[^a-z0-9]+', slugify(value))
        if token and len(token) > 1
    }


def jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
    if not set_a and not set_b:
        return 0.0
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


def rank_weight(index: int, length: int) -> float:
    if length <= 0:
        return 0.0
    return max(0.22, 1.0 - (index / max(length - 1, 1)) * 0.68)


def weighted_overlap(ordered_a: list[str], ordered_b: list[str]) -> float:
    if not ordered_a or not ordered_b:
        return 0.0
    weights_a = {item: rank_weight(index, len(ordered_a)) for index, item in enumerate(ordered_a)}
    weights_b = {item: rank_weight(index, len(ordered_b)) for index, item in enumerate(ordered_b)}
    shared = set(weights_a) & set(weights_b)
    if not shared:
        return 0.0
    numerator = sum((weights_a[item] + weights_b[item]) / 2 for item in shared)
    denominator = sum(weights_a.values()) + sum(weights_b.values())
    return min(1.0, (2 * numerator) / denominator) if denominator else 0.0


def fuzzy_name_similarity(name_a: str, name_b: str) -> float:
    a = slugify(name_a)
    b = slugify(name_b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    token_overlap = jaccard_similarity(tokenize(a), tokenize(b))
    sequence = SequenceMatcher(None, a, b).ratio()
    return max(token_overlap, sequence * 0.85)


def list_token_overlap(list_a: list[str], list_b: list[str]) -> float:
    tokens_a = {token for item in list_a for token in tokenize(item)}
    tokens_b = {token for item in list_b for token in tokenize(item)}
    return jaccard_similarity(tokens_a, tokens_b)


def normalize_audio(audio: dict | None) -> dict:
    audio = audio or {}
    normalized: dict[str, float | None] = {}
    for key in AUDIO_KEYS:
        value = clamp(audio.get(key))
        if key == 'tempo' and audio.get(key) is not None:
            value = clamp(float(audio.get(key)) / 200.0)
        normalized[key] = value
    return normalized


def similarity_from_distance(distance: float, max_distance: float = 1.0) -> float:
    return max(0.0, 1.0 - (distance / max_distance))


def compare_weighted_vectors(weights_a: dict[str, float], weights_b: dict[str, float]) -> float:
    universe = set(weights_a) | set(weights_b)
    if not universe:
        return 0.0
    numerator = sum(min(weights_a.get(key, 0.0), weights_b.get(key, 0.0)) for key in universe)
    denominator = sum(max(weights_a.get(key, 0.0), weights_b.get(key, 0.0)) for key in universe)
    return numerator / denominator if denominator else 0.0


def genre_weight_map(genres: list[dict | str] | None) -> dict[str, float]:
    normalized: dict[str, float] = {}
    for index, item in enumerate(genres or []):
        if isinstance(item, dict):
            name = display_name(item, 'genre', 'name')
            weight = float(item.get('count') or rank_weight(index, len(genres or [])))
        else:
            name = display_name(item)
            weight = rank_weight(index, len(genres or []))
        slug = slugify(name)
        if not slug:
            continue
        normalized[slug] = normalized.get(slug, 0.0) + weight
    total = sum(normalized.values()) or 1.0
    return {key: value / total for key, value in normalized.items()}


def genre_neighbor_score(genres_a: dict[str, float], genres_b: dict[str, float]) -> float:
    if not genres_a or not genres_b:
        return 0.0
    score = 0.0
    comparisons = 0
    for genre, weight in genres_a.items():
        neighbors = GENRE_NEIGHBORS.get(genre, set())
        if not neighbors:
            continue
        candidate = max((genres_b.get(neighbor, 0.0) for neighbor in neighbors), default=0.0)
        score += min(weight, candidate)
        comparisons += 1
    return min(1.0, score / comparisons * 3) if comparisons else 0.0


def compute_artist_overlap(profile_a: dict, profile_b: dict) -> ScoreResult:
    artists_a_raw = profile_a.get('topArtists') or profile_a.get('artists') or []
    artists_b_raw = profile_b.get('topArtists') or profile_b.get('artists') or []
    mapping_a, ordered_a = normalize_name_set(artists_a_raw, 'name')
    mapping_b, ordered_b = normalize_name_set(artists_b_raw, 'name')
    shared = list(set(ordered_a) & set(ordered_b))

    weighted = weighted_overlap(ordered_a[:30], ordered_b[:30])
    exact = jaccard_similarity(set(ordered_a), set(ordered_b))

    genres_a = []
    for artist in artists_a_raw[:20]:
        if isinstance(artist, dict):
            genres_a.extend([slugify(genre) for genre in (artist.get('genres') or []) if genre])
    genres_b = []
    for artist in artists_b_raw[:20]:
        if isinstance(artist, dict):
            genres_b.extend([slugify(genre) for genre in (artist.get('genres') or []) if genre])
    neighborhood = jaccard_similarity(set(genres_a), set(genres_b))

    score = normalize_score((weighted * 0.58 + exact * 0.26 + neighborhood * 0.16) * 100)
    shared_names = [mapping_a[item] for item in ordered_a if item in shared][:8]

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, max(len(ordered_a), len(ordered_b)) / 20.0),
        details={
            'sharedArtists': shared_names,
            'sharedArtistKeys': shared[:8],
            'exactSimilarity': normalize_score(exact * 100),
            'weightedSimilarity': normalize_score(weighted * 100),
            'neighborhoodSimilarity': normalize_score(neighborhood * 100),
        },
    )


def compute_genre_overlap(profile_a: dict, profile_b: dict) -> ScoreResult:
    weights_a = genre_weight_map(profile_a.get('genres'))
    weights_b = genre_weight_map(profile_b.get('genres'))
    exact = compare_weighted_vectors(weights_a, weights_b)
    neighbor = genre_neighbor_score(weights_a, weights_b)
    token = list_token_overlap(list(weights_a.keys()), list(weights_b.keys()))
    score = normalize_score((exact * 0.6 + neighbor * 0.25 + token * 0.15) * 100)
    shared = [genre for genre in weights_a if genre in weights_b][:8]

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, max(len(weights_a), len(weights_b)) / 10.0),
        details={
            'sharedGenres': shared,
            'genreWeightsA': weights_a,
            'genreWeightsB': weights_b,
            'exactSimilarity': normalize_score(exact * 100),
            'adjacentSimilarity': normalize_score(neighbor * 100),
        },
    )


def extract_track_year(track: dict | str | None) -> int | None:
    if isinstance(track, dict):
        direct = track.get('release_year') or track.get('year')
        if direct is not None:
            try:
                return int(direct)
            except (TypeError, ValueError):
                pass
        release_date = str(track.get('release_date') or '')
        if len(release_date) >= 4 and release_date[:4].isdigit():
            return int(release_date[:4])
    return None


def average_release_year(tracks: list[dict | str] | None) -> float | None:
    years = [extract_track_year(track) for track in (tracks or [])]
    normalized = [year for year in years if year is not None]
    if not normalized:
        return None
    return sum(normalized) / len(normalized)


def compute_song_overlap(profile_a: dict, profile_b: dict) -> ScoreResult:
    tracks_a_raw = profile_a.get('topTracks') or profile_a.get('tracks') or []
    tracks_b_raw = profile_b.get('topTracks') or profile_b.get('tracks') or []
    mapping_a, ordered_a = normalize_name_set(tracks_a_raw, 'title', 'name')
    mapping_b, ordered_b = normalize_name_set(tracks_b_raw, 'title', 'name')
    shared = [item for item in ordered_a if item in set(ordered_b)]

    exact = jaccard_similarity(set(ordered_a), set(ordered_b))
    weighted = weighted_overlap(ordered_a[:30], ordered_b[:30])

    artist_overlap = 0.0
    if tracks_a_raw and tracks_b_raw:
        artists_a = {slugify(display_name(track, 'artist')) for track in tracks_a_raw if display_name(track, 'artist')}
        artists_b = {slugify(display_name(track, 'artist')) for track in tracks_b_raw if display_name(track, 'artist')}
        artist_overlap = jaccard_similarity(artists_a, artists_b)

    year_a = average_release_year(tracks_a_raw)
    year_b = average_release_year(tracks_b_raw)
    era_similarity = similarity_from_distance(abs(year_a - year_b), 18.0) if year_a and year_b else 0.0

    score = normalize_score((exact * 0.52 + weighted * 0.18 + artist_overlap * 0.18 + era_similarity * 0.12) * 100)

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, max(len(ordered_a), len(ordered_b)) / 18.0),
        details={
            'sharedTracks': [mapping_a[item] for item in shared][:8],
            'eraSimilarity': normalize_score(era_similarity * 100) if year_a and year_b else None,
            'artistAdjacency': normalize_score(artist_overlap * 100),
        },
    )


def extract_tags(profile: dict, keys: list[str]) -> list[str]:
    values: list[str] = []
    for key in keys:
        raw = profile.get(key) or []
        if isinstance(raw, str):
            values.append(raw)
        else:
            values.extend([
                display_name(item, 'label', 'name', 'title', 'genre')
                for item in raw
            ])
    return [slugify(item) for item in values if item]


def compute_emotional_compatibility(profile_a: dict, profile_b: dict) -> ScoreResult:
    audio_a = normalize_audio(profile_a.get('audioFeatures') or profile_a.get('audio'))
    audio_b = normalize_audio(profile_b.get('audioFeatures') or profile_b.get('audio'))

    similarities = []
    for key in EMOTIONAL_AUDIO_KEYS:
        a = audio_a.get(key)
        b = audio_b.get(key)
        if a is None or b is None:
            continue
        max_distance = 0.9 if key == 'tempo' else 1.0
        similarities.append(similarity_from_distance(abs(a - b), max_distance))

    audio_similarity = sum(similarities) / len(similarities) if similarities else None
    tag_overlap = jaccard_similarity(
        set(extract_tags(profile_a, ['moodTags', 'aestheticTags', 'atmosphereLabels', 'regionLabels'])),
        set(extract_tags(profile_b, ['moodTags', 'aestheticTags', 'atmosphereLabels', 'regionLabels'])),
    )
    mood_a = slugify(display_name(profile_a.get('analyticsMetrics') or {}, 'mood') or profile_a.get('emotionalSignature'))
    mood_b = slugify(display_name(profile_b.get('analyticsMetrics') or {}, 'mood') or profile_b.get('emotionalSignature'))
    mood_similarity = 1.0 if mood_a and mood_a == mood_b else (0.55 if mood_a and mood_b and mood_a != mood_b else 0.0)

    emotional = (
        (audio_similarity if audio_similarity is not None else 0.0) * 0.62
        + tag_overlap * 0.23
        + mood_similarity * 0.15
    )
    score = normalize_score(emotional * 100)
    confidence_weight = 0.35
    if audio_similarity is not None:
        confidence_weight += 0.4
    if tag_overlap > 0:
        confidence_weight += 0.15
    if mood_a or mood_b:
        confidence_weight += 0.1

    shared_atmosphere = sorted(set(extract_tags(profile_a, ['moodTags', 'aestheticTags', 'atmosphereLabels'])) & set(extract_tags(profile_b, ['moodTags', 'aestheticTags', 'atmosphereLabels'])))

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, confidence_weight),
        details={
            'audioSimilarity': normalize_score((audio_similarity or 0.0) * 100) if audio_similarity is not None else None,
            'tagOverlap': normalize_score(tag_overlap * 100),
            'moodAlignment': normalize_score(mood_similarity * 100),
            'sharedAtmosphere': shared_atmosphere[:8],
        },
    )


def derive_trait_scores(profile: dict) -> dict[str, float]:
    raw = profile.get('traitScores') or {}
    normalized: dict[str, float] = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            numeric = clamp(value, 0.0, 100.0)
            if numeric is not None:
                normalized[slugify(key)] = numeric / 100.0 if numeric > 1 else numeric

    if normalized:
        return normalized

    personality = profile.get('personalityTraits') or profile.get('personality') or []
    for trait in personality:
        if not isinstance(trait, dict):
            continue
        label = slugify(trait.get('label') or trait.get('id'))
        pct = clamp(trait.get('pct') or trait.get('score'), 0.0, 100.0)
        if label and pct is not None:
            normalized[label] = pct / 100.0 if pct > 1 else pct

    mbti = profile.get('mbtiProfile') or profile.get('mbti') or {}
    axes = mbti.get('axes') if isinstance(mbti, dict) else None
    if isinstance(axes, dict):
        for axis_name, axis in axes.items():
            label = slugify(axis.get('label') or axis_name)
            score = clamp(axis.get('score'), 0.0, 100.0)
            if label and score is not None:
                normalized[label] = score / 100.0 if score > 1 else score

    return normalized


def mbti_pair_score(type_a: str | None, type_b: str | None) -> float:
    a = slugify(type_a).upper()
    b = slugify(type_b).upper()
    if not a or not b or len(a) != 4 or len(b) != 4:
        return 0.0
    if a == b:
        return 0.92
    if (a, b) in MBTI_COMPLEMENTS or (b, a) in MBTI_COMPLEMENTS:
        return 0.86

    score = 0.0
    for index, axis_a in enumerate(a):
        axis_b = b[index]
        if axis_a == axis_b:
            score += SAME_AXIS_WEIGHT
        elif {axis_a, axis_b} in [{'J', 'P'}, {'T', 'F'}]:
            score += ADJACENT_AXIS_WEIGHT
        else:
            score += CONTRAST_AXIS_WEIGHT
    return score / 4.0


def compute_mbti_compatibility(profile_a: dict, profile_b: dict) -> ScoreResult:
    mbti_a = (profile_a.get('mbtiType') or (profile_a.get('mbti') or {}).get('type') or '').upper()
    mbti_b = (profile_b.get('mbtiType') or (profile_b.get('mbti') or {}).get('type') or '').upper()
    type_score = mbti_pair_score(mbti_a, mbti_b)

    traits_a = derive_trait_scores(profile_a)
    traits_b = derive_trait_scores(profile_b)
    shared_trait_keys = set(traits_a) & set(traits_b)
    trait_similarity = 0.0
    if shared_trait_keys:
        trait_similarity = sum(1 - abs(traits_a[key] - traits_b[key]) for key in shared_trait_keys) / len(shared_trait_keys)

    descriptors_a = {slugify(display_name(item, 'label', 'id')) for item in (profile_a.get('personalityTraits') or profile_a.get('personality') or [])}
    descriptors_b = {slugify(display_name(item, 'label', 'id')) for item in (profile_b.get('personalityTraits') or profile_b.get('personality') or [])}
    descriptor_overlap = jaccard_similarity(descriptors_a, descriptors_b)

    score = normalize_score((type_score * 0.48 + trait_similarity * 0.34 + descriptor_overlap * 0.18) * 100)
    shared_traits = sorted(shared_trait_keys, key=lambda key: abs(traits_a.get(key, 0) - traits_b.get(key, 0)))[:6]

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, (0.5 if mbti_a and mbti_b else 0.0) + (0.5 if traits_a and traits_b else 0.0)),
        details={
            'mbtiMatchType': 'mirrored' if mbti_a and mbti_a == mbti_b else ('complementary' if (mbti_a, mbti_b) in MBTI_COMPLEMENTS or (mbti_b, mbti_a) in MBTI_COMPLEMENTS else 'adjacent'),
            'mbtiTypes': [mbti_a or None, mbti_b or None],
            'sharedTraits': shared_traits,
            'traitSimilarity': normalize_score(trait_similarity * 100),
            'descriptorOverlap': normalize_score(descriptor_overlap * 100),
        },
    )


def compute_discovery_compatibility(profile_a: dict, profile_b: dict, artist: ScoreResult, genre: ScoreResult, emotional: ScoreResult) -> ScoreResult:
    artists_a_raw = profile_a.get('topArtists') or profile_a.get('artists') or []
    artists_b_raw = profile_b.get('topArtists') or profile_b.get('artists') or []
    _, ordered_a = normalize_name_set(artists_a_raw, 'name')
    _, ordered_b = normalize_name_set(artists_b_raw, 'name')
    exclusive_a = [item for item in ordered_a[:20] if item not in set(ordered_b)]
    exclusive_b = [item for item in ordered_b[:20] if item not in set(ordered_a)]

    genre_weights_a = genre.details.get('genreWeightsA', {})
    genre_weights_b = genre.details.get('genreWeightsB', {})

    def fit_exclusive(exclusive: list[str], target_weights: dict[str, float], source_artists: list[dict | str]) -> float:
        if not exclusive or not source_artists:
            return 0.0
        fit_scores = []
        for item in source_artists[:20]:
            if not isinstance(item, dict):
                continue
            name = slugify(item.get('name'))
            if name not in exclusive:
                continue
            artist_genres = [slugify(value) for value in (item.get('genres') or []) if value]
            if not artist_genres:
                continue
            exact = max((target_weights.get(genre_name, 0.0) for genre_name in artist_genres), default=0.0)
            nearby = max((max((target_weights.get(neighbor, 0.0) for neighbor in GENRE_NEIGHBORS.get(genre_name, set())), default=0.0) for genre_name in artist_genres), default=0.0)
            fit_scores.append(max(exact, nearby * 0.85))
        if not fit_scores:
            return 0.0
        return sum(fit_scores) / len(fit_scores)

    a_to_b = fit_exclusive(exclusive_a, genre_weights_b, artists_a_raw)
    b_to_a = fit_exclusive(exclusive_b, genre_weights_a, artists_b_raw)
    emotional_factor = emotional.score / 100.0
    score = normalize_score(((a_to_b + b_to_a) / 2 * 0.68 + emotional_factor * 0.32) * 100)

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, max(artist.confidence_weight, genre.confidence_weight)),
        details={
            'userAToUserB': normalize_score(a_to_b * 100),
            'userBToUserA': normalize_score(b_to_a * 100),
        },
    )


def derive_trait_vector(profile: dict) -> dict[str, float]:
    base = derive_trait_scores(profile)
    output = dict(base)

    if 'dreamy' not in output:
        output['dreamy'] = 0.6 if any('dream' in tag for tag in extract_tags(profile, ['aestheticTags', 'atmosphereLabels'])) else 0.0
    if 'nostalgic' not in output:
        year = average_release_year(profile.get('topTracks') or profile.get('tracks'))
        output['nostalgic'] = clamp((2026 - year) / 30.0) if year else 0.0
    if 'exploratory' not in output:
        output['exploratory'] = min(1.0, len(profile.get('genres') or []) / 12.0)
    if 'atmospheric' not in output:
        output['atmospheric'] = 1.0 if any(tag in {'ambient', 'ethereal', 'shoegaze', 'dream pop'} for tag in extract_tags(profile, ['genres', 'aestheticTags'])) else 0.3
    if 'lyrical' not in output:
        speech = normalize_audio(profile.get('audioFeatures') or profile.get('audio')).get('speechiness')
        output['lyrical'] = speech or 0.25
    if 'textural' not in output:
        instrumental = normalize_audio(profile.get('audioFeatures') or profile.get('audio')).get('instrumentalness')
        acoustic = normalize_audio(profile.get('audioFeatures') or profile.get('audio')).get('acousticness')
        output['textural'] = ((instrumental or 0.0) * 0.6 + (acoustic or 0.0) * 0.4)
    return output


def compute_tension_profile(profile_a: dict, profile_b: dict, emotional: ScoreResult, discovery: ScoreResult) -> ScoreResult:
    traits_a = derive_trait_vector(profile_a)
    traits_b = derive_trait_vector(profile_b)
    differences = {key: abs(traits_a.get(key, 0.0) - traits_b.get(key, 0.0)) for key in set(traits_a) | set(traits_b)}

    core_difference = sum(differences.values()) / max(len(differences), 1)
    productive = 0.0
    complementary_traits: list[str] = []
    contrasting_traits: list[str] = []

    for left, right in TENSION_TRAIT_PAIRS:
        left_a = traits_a.get(left, 0.0)
        right_a = traits_a.get(right, 0.0)
        left_b = traits_b.get(left, 0.0)
        right_b = traits_b.get(right, 0.0)
        complement = max(min(left_a, right_b), min(right_a, left_b))
        if complement >= 0.42:
            productive += complement
            complementary_traits.append(f'{left} / {right}')
        gap = abs((left_a + right_a) - (left_b + right_b))
        if gap >= 0.38:
            contrasting_traits.append(f'{left} vs {right}')

    productive = min(1.0, productive / max(len(TENSION_TRAIT_PAIRS) * 0.32, 1))
    discovery_factor = discovery.score / 100.0
    emotional_factor = emotional.score / 100.0
    tension_value = core_difference * 0.46 + productive * 0.34 + discovery_factor * 0.2
    score = normalize_score(tension_value * 100)

    if score >= 76 and discovery.score >= 68:
        tension_type = 'beautiful tension'
    elif score >= 62:
        tension_type = 'magnetic'
    elif score >= 40:
        tension_type = 'complementary'
    elif score >= 22:
        tension_type = 'gentle contrast'
    else:
        tension_type = 'mirrored'

    if emotional_factor < 0.34 and discovery_factor < 0.34:
        tension_type = 'incompatible'

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, 0.55 + discovery.confidence_weight * 0.25 + emotional.confidence_weight * 0.2),
        details={
            'tensionType': tension_type,
            'complementaryTraits': complementary_traits[:5],
            'contrastingTraits': contrasting_traits[:5],
            'productiveDifference': normalize_score(productive * 100),
        },
    )


def compute_orb_resonance(emotional: ScoreResult, mbti: ScoreResult, tension: ScoreResult, profile_a: dict, profile_b: dict) -> ScoreResult:
    emotional_value = emotional.score / 100.0
    mbti_value = mbti.score / 100.0
    tension_value = tension.score / 100.0

    balance = 1.0 - abs(emotional_value - mbti_value)
    healthy_tension = 1.0 - abs(tension_value - 0.58)
    score = normalize_score((emotional_value * 0.48 + mbti_value * 0.2 + balance * 0.12 + healthy_tension * 0.2) * 100)

    if emotional_value >= 0.82 and mbti_value >= 0.74:
        harmony = 'mirrored'
    elif tension_value >= 0.7 and emotional_value >= 0.58:
        harmony = 'magnetic'
    elif emotional_value >= 0.65 and tension_value <= 0.52:
        harmony = 'stabilizing'
    elif tension_value >= 0.8:
        harmony = 'soft collision'
    else:
        harmony = 'asymmetrical'

    aura_overlap = sorted(set(extract_tags(profile_a, ['atmosphereLabels', 'aestheticTags'])) & set(extract_tags(profile_b, ['atmosphereLabels', 'aestheticTags'])))[:5]

    return ScoreResult(
        score=score,
        confidence_weight=min(1.0, emotional.confidence_weight * 0.55 + mbti.confidence_weight * 0.2 + tension.confidence_weight * 0.25),
        details={
            'orbHarmony': harmony,
            'orbDissonance': normalize_score(abs(emotional.score - mbti.score)),
            'phaseAlignment': normalize_score(balance * 100),
            'auraOverlap': aura_overlap,
        },
    )


def compute_rarity(overall: int, emotional: ScoreResult, discovery: ScoreResult, tension: ScoreResult, artist: ScoreResult, genre: ScoreResult, mbti: ScoreResult) -> ScoreResult:
    emotional_value = emotional.score / 100.0
    discovery_value = discovery.score / 100.0
    tension_value = tension.score / 100.0
    overlap_value = ((artist.score + genre.score) / 2) / 100.0
    mbti_value = mbti.score / 100.0

    rarity = (
        (1.0 - abs(tension_value - 0.62)) * 0.28
        + discovery_value * 0.24
        + emotional_value * 0.18
        + (1.0 - overlap_value) * 0.16
        + (1.0 - abs(mbti_value - 0.78)) * 0.14
    )
    score = normalize_score(rarity * 100)
    if score >= 88:
        label = 'cosmic anomaly'
    elif score >= 74:
        label = 'very rare'
    elif score >= 58:
        label = 'rare'
    elif score >= 40:
        label = 'uncommon'
    else:
        label = 'common'

    return ScoreResult(
        score=score,
        confidence_weight=0.72,
        details={'rarityLabel': label, 'overall': overall},
    )


def compute_overall_compatibility(
    emotional: ScoreResult,
    mbti: ScoreResult,
    artist: ScoreResult,
    genre: ScoreResult,
    song: ScoreResult,
    discovery: ScoreResult,
    tension: ScoreResult,
    orb: ScoreResult,
    confidence: float,
) -> int:
    base = (
        emotional.score * 0.26
        + mbti.score * 0.18
        + artist.score * 0.12
        + genre.score * 0.1
        + song.score * 0.05
        + discovery.score * 0.1
        + orb.score * 0.15
    )
    tension_bonus = max(0.0, 1.0 - abs((tension.score / 100.0) - 0.58)) * 8.0
    confidence_modifier = 0.82 + max(0.0, min(1.0, confidence)) * 0.18
    return normalize_score((base + tension_bonus) * confidence_modifier)


def compatibility_tier(score: int) -> str:
    if score >= 88:
        return 'luminous'
    if score >= 75:
        return 'rare'
    if score >= 60:
        return 'aligned'
    if score >= 45:
        return 'emerging'
    return 'partial'


def compare_track_to_profile(track: dict, target_profile: dict, source_side: str) -> dict | None:
    if not isinstance(track, dict):
        return None

    title = display_name(track, 'title', 'name')
    if not title:
        return None

    target_audio = normalize_audio(target_profile.get('audioFeatures') or target_profile.get('audio'))
    track_audio = normalize_audio(track.get('audio_features'))
    audio_parts = []
    for key in ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness']:
        a = track_audio.get(key)
        b = target_audio.get(key)
        if a is None or b is None:
            continue
        audio_parts.append(similarity_from_distance(abs(a - b)))
    audio_fit = sum(audio_parts) / len(audio_parts) if audio_parts else None

    target_genres = genre_weight_map(target_profile.get('genres'))
    artist_name = slugify(display_name(track, 'artist'))
    artist_fit = 0.0
    artist_genres = []
    for artist in target_profile.get('topArtists') or target_profile.get('artists') or []:
        if artist_name and artist_name == slugify(display_name(artist, 'name')):
            artist_fit = 1.0
            artist_genres = [slugify(value) for value in (artist.get('genres') or []) if value]
            break

    era_fit = 0.0
    track_year = extract_track_year(track)
    avg_year = average_release_year(target_profile.get('topTracks') or target_profile.get('tracks'))
    if track_year and avg_year:
        era_fit = similarity_from_distance(abs(track_year - avg_year), 18.0)

    genre_fit = max((target_genres.get(name, 0.0) for name in artist_genres), default=0.0) if artist_genres else 0.0

    fit = (
        (audio_fit if audio_fit is not None else 0.0) * 0.45
        + artist_fit * 0.28
        + genre_fit * 0.17
        + era_fit * 0.1
    )

    if fit <= 0:
        return None

    return {
        'title': title,
        'artist': display_name(track, 'artist'),
        'score': normalize_score(fit * 100),
        'source': source_side,
        'reason': 'emotional fit' if audio_fit and audio_fit >= max(artist_fit, genre_fit) else ('artist bridge' if artist_fit >= genre_fit else 'genre bridge'),
    }


def generate_bridge_tracks(profile_a: dict, profile_b: dict) -> dict:
    tracks_a = profile_a.get('topTracks') or profile_a.get('tracks') or []
    tracks_b = profile_b.get('topTracks') or profile_b.get('tracks') or []
    mapping_a, ordered_a = normalize_name_set(tracks_a, 'title', 'name')
    _, ordered_b = normalize_name_set(tracks_b, 'title', 'name')
    shared_keys = set(ordered_a) & set(ordered_b)

    shared_tracks = []
    for key in ordered_a:
        if key in shared_keys:
            artist_name = ''
            for track in tracks_a:
                if slugify(display_name(track, 'title', 'name')) == key:
                    artist_name = display_name(track, 'artist')
                    break
            shared_tracks.append({'title': mapping_a[key], 'artist': artist_name, 'score': 100, 'reason': 'mutual favorite'})

    from_a = [compare_track_to_profile(track, profile_b, 'user_a') for track in tracks_a[:16]]
    from_b = [compare_track_to_profile(track, profile_a, 'user_b') for track in tracks_b[:16]]

    user_a_to_b = [item for item in from_a if item and slugify(item['title']) not in shared_keys]
    user_b_to_a = [item for item in from_b if item and slugify(item['title']) not in shared_keys]
    user_a_to_b.sort(key=lambda item: item['score'], reverse=True)
    user_b_to_a.sort(key=lambda item: item['score'], reverse=True)

    bridge_pool = shared_tracks + user_a_to_b[:4] + user_b_to_a[:4]
    deduped: dict[str, dict] = {}
    for item in bridge_pool:
        key = slugify(item['title'])
        existing = deduped.get(key)
        if existing is None or item['score'] > existing['score']:
            deduped[key] = item
    bridge_tracks = sorted(deduped.values(), key=lambda item: item['score'], reverse=True)[:8]

    return {
        'sharedTracks': shared_tracks[:6],
        'bridgeTracks': bridge_tracks,
        'userAToUserBRecommendations': user_a_to_b[:5],
        'userBToUserARecommendations': user_b_to_a[:5],
    }


def classify_relationship_archetype(metrics: dict) -> dict:
    for archetype in RELATIONSHIP_ARCHETYPES:
        if archetype['when'](metrics):
            return {
                'relationshipArchetype': archetype['title'],
                'archetypeId': archetype['id'],
                'archetypeSummary': archetype['summary'],
            }

    if metrics['overallCompatibility'] >= 72:
        title = 'Silver Echoes'
        summary = 'A pairing built on steady recognition, low-noise intimacy, and shared afterglow.'
    elif metrics['discoveryCompatibility'] >= 68:
        title = 'Dream & Gravity'
        summary = 'One of you opens the horizon while the other gives it weight.'
    elif metrics['tensionScore'] >= 62:
        title = 'Parallel Ache'
        summary = 'You do not carry the same feeling the same way, but the pull is real.'
    else:
        title = 'Luminous Strangers'
        summary = 'The chemistry is still forming, but the bridge is visible.'

    return {
        'relationshipArchetype': title,
        'archetypeId': slugify(title).replace(' ', '_'),
        'archetypeSummary': summary,
    }

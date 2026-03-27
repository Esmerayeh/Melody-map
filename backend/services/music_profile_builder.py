"""
music_profile_builder.py
------------------------
Aggregates Spotify data into a single structured music profile.
Called by the /api/music-profile endpoint.
Calls Spotify Web API directly — no internal proxy self-calls.
"""

from __future__ import annotations
from datetime import datetime, timezone
import math
import requests as req

PROFILE_SCHEMA_VERSION = '2026-03-profile-v1'
ANALYTICS_METHODS = {
    'energyScore': 'mean(spotify_audio_features.energy)',
    'valenceScore': 'mean(spotify_audio_features.valence)',
    'danceabilityScore': 'mean(spotify_audio_features.danceability)',
    'acousticnessScore': 'mean(spotify_audio_features.acousticness)',
    'tempoAvg': 'mean(spotify_audio_features.tempo)',
    'speechinessScore': 'mean(spotify_audio_features.speechiness)',
    'instrumentalScore': 'mean(spotify_audio_features.instrumentalness)',
    'nostalgiaIndex': 'normalized age of release years from analyzed top tracks',
    'diversityScore': 'normalized genre entropy derived from canonical top artists',
    'sonicBrightness': '0.45*valence + 0.35*energy + 0.2*(1-acousticness)',
    'mood': 'threshold classification over aggregate energy and valence',
}

# ── Audio feature averages ─────────────────────────────────────────────────────

def _avg(items: list[dict], key: str) -> float | None:
    vals = [float(v[key]) for v in items if v and v.get(key) is not None]
    return sum(vals) / len(vals) if vals else None


def _count_present(items: list[dict], key: str) -> int:
    return sum(1 for item in items if item and item.get(key) is not None)


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


# ── Mood derivation ────────────────────────────────────────────────────────────

def _derive_mood(energy: float | None, valence: float | None) -> str | None:
    if energy is None or valence is None:
        return None
    if energy > 0.7 and valence > 0.6:   return 'euphoric'
    if energy > 0.7 and valence < 0.4:   return 'intense'
    if energy > 0.7:                     return 'energetic'
    if energy < 0.35 and valence < 0.35: return 'melancholic'
    if energy < 0.35 and valence > 0.6:  return 'serene'
    if energy < 0.35:                    return 'dreamy'
    if valence > 0.65:                   return 'uplifting'
    if valence < 0.35:                   return 'brooding'
    return 'balanced'


# ── Nostalgia index ────────────────────────────────────────────────────────────

def _nostalgia_index(tracks: list[dict]) -> float | None:
    import datetime
    current_year = datetime.datetime.utcnow().year
    years = []
    for t in tracks:
        rd = t.get('release_date') or ''
        if rd and len(rd) >= 4:
            try:
                years.append(int(rd[:4]))
            except ValueError:
                pass
    if not years:
        return None
    avg_year = sum(years) / len(years)
    return round(min(1.0, max(0.0, (current_year - avg_year) / (current_year - 1970))), 3)


# ── Genre extraction ───────────────────────────────────────────────────────────

def _extract_genres(artists: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for a in artists:
        for g in (a.get('genres') or []):
            key = g.lower().strip()
            counts[key] = counts.get(key, 0) + 1
    return sorted(
        [{'genre': g, 'count': c} for g, c in counts.items()],
        key=lambda x: x['count'], reverse=True
    )


# ── Aesthetic tags ─────────────────────────────────────────────────────────────

GENRE_AESTHETIC_MAP: dict[str, list[str]] = {
    'shoegaze':    ['dreamcore', 'neon fog', 'blurred lights', 'hazy bokeh'],
    'dream pop':   ['ethereal night', 'lavender haze', 'soft focus', 'pastel sky'],
    'indie rock':  ['neon city', 'vintage film', 'polaroid', 'warm grain'],
    'jazz':        ['smoky bar', 'amber night', 'noir photography', 'candlelit'],
    'electronic':  ['cyberpunk', 'neon grid', 'synthwave', 'glitch art'],
    'hip hop':     ['urban night', 'city skyline', 'golden hour', 'graffiti'],
    'r&b':         ['velvet night', 'moody portrait', 'warm candlelight'],
    'classical':   ['marble architecture', 'golden hour', 'baroque', 'misty forest'],
    'metal':       ['dark forest', 'storm clouds', 'gothic architecture'],
    'pop':         ['colorful neon', 'bubblegum', 'pastel room', 'bright lights'],
    'folk':        ['autumn forest', 'cozy cabin', 'golden wheat', 'wildflower'],
    'ambient':     ['deep ocean', 'starry night', 'aurora borealis', 'misty mountains'],
    'lo-fi':       ['rainy window', 'cozy study', 'warm lamp', 'vintage cassette'],
    'indie pop':   ['pastel aesthetic', 'soft sunlight', 'flower crown', 'dreamy portrait'],
    'alternative': ['moody landscape', 'overcast sky', 'film noir', 'abandoned building'],
    'synthwave':   ['retro neon grid', 'purple sunset highway', 'chrome reflections'],
    'vaporwave':   ['pastel glitch', 'retro computer', 'pink sunset mall'],
    'darkwave':    ['gothic cathedral', 'moonlit ruins', 'velvet shadows'],
    'post-rock':   ['vast landscape', 'cinematic horizon', 'long exposure sky'],
    'k-pop':       ['pastel studio', 'colorful fashion', 'neon aesthetic'],
    'trap':        ['neon city rain', 'dark moody portrait', 'luxury aesthetic'],
    'house':       ['colorful rave', 'laser lights', 'neon dance floor'],
    'emo':         ['rainy night', 'dark bedroom', 'melancholic portrait'],
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


def _build_aesthetic_tags(genres: list[dict], energy: float | None, valence: float | None) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for g in genres[:4]:
        for tag in GENRE_AESTHETIC_MAP.get(g['genre'], []):
            if tag not in seen:
                seen.add(tag)
                tags.append(tag)
    if energy is not None:
        for (lo, hi), etags in _ENERGY_TAGS.items():
            if lo <= energy < hi:
                for t in etags[:2]:
                    if t not in seen:
                        seen.add(t)
                        tags.append(t)
                break
    if valence is not None:
        for (lo, hi), vtags in _VALENCE_TAGS.items():
            if lo <= valence < hi:
                for t in vtags[:2]:
                    if t not in seen:
                        seen.add(t)
                        tags.append(t)
                break
    return tags[:16]


# ── Galaxy node builder ────────────────────────────────────────────────────────

def _hsl_from_genre(genre: str, index: int) -> str:
    hue = abs(hash(genre)) % 360
    return f'hsl({hue}, 70%, 55%)'


def _sonic_color(energy: float, valence: float) -> str:
    hue = round(valence * 260)
    sat = round(55 + energy * 30)
    lit = round(42 + valence * 18)
    return f'hsl({hue}, {sat}%, {lit}%)'


def _build_galaxy_nodes(artists: list[dict], genres: list[dict], audio_features: dict) -> list[dict]:
    nodes: list[dict] = []
    connections: dict[str, list[str]] = {}
    energy  = audio_features.get('energy')
    valence = audio_features.get('valence')
    dance   = audio_features.get('danceability')
    SPREAD  = 10.0

    genre_node_ids: dict[str, str] = {}
    for i, g in enumerate(genres[:12]):
        gid   = f'genre_{g["genre"].replace(" ", "_")}'
        angle = (i / max(len(genres[:12]), 1)) * 2 * math.pi
        r     = 6 + (g['count'] / max(genres[0]['count'], 1)) * 4
        node  = {
            'id':          gid,
            'label':       g['genre'],
            'type':        'genre',
            'genre':       g['genre'],
            'size':        0.4 + (g['count'] / max(genres[0]['count'], 1)) * 0.8,
            'color':       _hsl_from_genre(g['genre'], i),
            'x':           round(r * math.cos(angle), 2),
            'y':           round(_position_from_feature(energy, SPREAD * 0.5), 2),
            'z':           round(r * math.sin(angle), 2),
            'connections': [],
            'count':       g['count'],
        }
        nodes.append(node)
        genre_node_ids[g['genre']] = gid
        connections[gid] = []

    for i, artist in enumerate(artists[:30]):
        aid    = f'artist_{artist.get("id", i)}'
        pop    = (artist.get('popularity') or 50) / 100.0
        genres_list = artist.get('genres') or []
        primary_genre = genres_list[0] if genres_list else None
        if primary_genre and primary_genre in genre_node_ids:
            gnode = next((n for n in nodes if n['id'] == genre_node_ids[primary_genre]), None)
            if gnode:
                jitter = (pop - 0.5) * 3
                x = gnode['x'] + jitter
                y = gnode['y'] + (pop - 0.5) * 2
                z = gnode['z'] + jitter * 0.7
            else:
                x = _position_from_feature(valence, SPREAD) + (i % 5 - 2) * 1.5
                y = _position_from_feature(energy, SPREAD) + (pop - 0.5) * 3
                z = _position_from_feature(dance, SPREAD) + (i % 3 - 1) * 1.5
        else:
            x = _position_from_feature(valence, SPREAD) + (i % 5 - 2) * 1.5
            y = _position_from_feature(energy, SPREAD) + (pop - 0.5) * 3
            z = _position_from_feature(dance, SPREAD) + (i % 3 - 1) * 1.5

        node = {
            'id':          aid,
            'label':       artist.get('name', 'Unknown'),
            'type':        'artist',
            'genre':       primary_genre or '',
            'size':        0.3 + pop * 0.9,
            'color':       _sonic_color(energy if energy is not None else 0.5, valence if valence is not None else 0.5),
            'image':       artist.get('image'),
            'x':           round(x, 2),
            'y':           round(y, 2),
            'z':           round(z, 2),
            'connections': [],
            'popularity':  artist.get('popularity', 50),
            'spotify_url': artist.get('spotify_url'),
        }
        if primary_genre and primary_genre in genre_node_ids:
            node['connections'].append(genre_node_ids[primary_genre])
            connections.setdefault(genre_node_ids[primary_genre], []).append(aid)
        nodes.append(node)

    genre_keys = list(genre_node_ids.values())
    for i in range(len(genre_keys) - 1):
        nodes_by_id = {n['id']: n for n in nodes}
        if genre_keys[i] in nodes_by_id:
            nodes_by_id[genre_keys[i]]['connections'].append(genre_keys[i + 1])

    return nodes


# ── Analytics metrics ──────────────────────────────────────────────────────────

def _build_analytics(genres: list[dict], audio_features: dict, tracks: list[dict]) -> dict:
    energy       = audio_features.get('energy')
    valence      = audio_features.get('valence')
    dance        = audio_features.get('danceability')
    acoustic     = audio_features.get('acousticness')
    tempo        = audio_features.get('tempo')
    speech       = audio_features.get('speechiness')
    instrumental = audio_features.get('instrumentalness')

    total = sum(g['count'] for g in genres) or 1
    entropy = -sum((g['count'] / total) * math.log2(g['count'] / total)
                   for g in genres if g['count'] > 0)
    max_entropy = math.log2(len(genres)) if len(genres) > 1 else 1
    diversity = round(min(1.0, entropy / max_entropy) * 100)
    brightness = None
    if energy is not None and valence is not None and acoustic is not None:
        brightness = round((valence * 0.45 + energy * 0.35 + (1 - acoustic) * 0.2) * 100)

    nostalgia_raw = _nostalgia_index(tracks)
    nostalgia = round(nostalgia_raw * 100) if nostalgia_raw is not None else None

    return {
        'mood':              _derive_mood(energy, valence),
        'energyScore':       round(energy * 100) if energy is not None else None,
        'valenceScore':      round(valence * 100) if valence is not None else None,
        'danceabilityScore': round(dance * 100) if dance is not None else None,
        'acousticnessScore': round(acoustic * 100) if acoustic is not None else None,
        'tempoAvg':          round(tempo) if tempo is not None else None,
        'speechinessScore':  round(speech * 100) if speech is not None else None,
        'instrumentalScore': round(instrumental * 100) if instrumental is not None else None,
        'nostalgiaIndex':    nostalgia,
        'diversityScore':    diversity,
        'sonicBrightness':   brightness,
    }


def _build_metric_metadata(
    audio_features_list: list[dict],
    track_count: int,
    genres: list[dict],
    analytics: dict,
    tracks: list[dict],
) -> dict:
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
        ratio = (present / track_count) if track_count else 0.0
        sample_sizes[metric_key] = present
        feature_coverage[feature_key] = {
            'count': present,
            'requested': track_count,
            'ratio': round(ratio, 3),
        }
        metric_confidence[metric_key] = {
            **_confidence_from_ratio(ratio),
            'sampleSize': present,
            'requested': track_count,
            'method': ANALYTICS_METHODS[metric_key],
        }

    genre_total = sum(g['count'] for g in genres) or 0
    genre_ratio = min(1.0, genre_total / max(len(tracks), 1)) if tracks else 0.0
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
    mood_ratio = mood_sources / max(track_count, 1) if track_count else 0.0
    sample_sizes['mood'] = mood_sources
    metric_confidence['mood'] = {
        **_confidence_from_ratio(mood_ratio),
        'sampleSize': mood_sources,
        'requested': track_count,
        'method': ANALYTICS_METHODS['mood'],
    }

    brightness_sources = min(
        sample_sizes.get('energyScore', 0),
        sample_sizes.get('valenceScore', 0),
        sample_sizes.get('acousticnessScore', 0),
    )
    brightness_ratio = brightness_sources / max(track_count, 1) if track_count else 0.0
    sample_sizes['sonicBrightness'] = brightness_sources
    metric_confidence['sonicBrightness'] = {
        **_confidence_from_ratio(brightness_ratio),
        'sampleSize': brightness_sources,
        'requested': track_count,
        'method': ANALYTICS_METHODS['sonicBrightness'],
    }

    analytics['sampleSizes'] = sample_sizes
    analytics['metricConfidence'] = metric_confidence
    analytics['featureCoverageByMetric'] = feature_coverage
    analytics['methodology'] = ANALYTICS_METHODS
    return analytics


# ── Main builder ───────────────────────────────────────────────────────────────

def build_music_profile(
    spotify_token: str,
    time_range: str = 'medium_term',
    limit: int = 50,
) -> dict:
    """
    Fetch Spotify data and build a complete music profile.
    Calls Spotify Web API directly — no internal proxy self-calls.
    """
    SPOTIFY = 'https://api.spotify.com/v1'
    headers = {'Authorization': f'Bearer {spotify_token}'}

    def _get(path: str, params: dict | None = None) -> dict:
        try:
            r = req.get(f'{SPOTIFY}{path}', headers=headers, params=params, timeout=10)
            if r.status_code == 401:
                return {}
            r.raise_for_status()
            return r.json()
        except Exception:
            return {}

    # ── Fetch raw data ─────────────────────────────────────────────────────────
    user_profile_raw    = _get('/me')
    top_artists_raw     = _get('/me/top/artists', {'limit': min(limit, 50), 'time_range': time_range})
    top_tracks_raw      = _get('/me/top/tracks',  {'limit': min(limit, 50), 'time_range': time_range})
    recently_played_raw = _get('/me/player/recently-played', {'limit': 50})
    saved_tracks_raw    = _get('/me/tracks', {'limit': 50})

    # ── Normalize top artists ──────────────────────────────────────────────────
    top_artists: list[dict] = []
    for item in (top_artists_raw.get('items') or []):
        if not item:
            continue
        top_artists.append({
            'id':         item.get('id'),
            'name':       item.get('name'),
            'genres':     item.get('genres', []),
            'popularity': item.get('popularity', 0),
            'image':      item['images'][0]['url'] if item.get('images') else None,
            'spotify_url': item.get('external_urls', {}).get('spotify'),
        })

    # ── Normalize top tracks ───────────────────────────────────────────────────
    top_tracks: list[dict] = []
    for item in (top_tracks_raw.get('items') or []):
        if not item:
            continue
        top_tracks.append({
            'id':          item.get('id'),
            'title':       item.get('name'),
            'artist':      item['artists'][0]['name'] if item.get('artists') else '',
            'artists':     [a['name'] for a in item.get('artists', [])],
            'album':       item.get('album', {}).get('name', ''),
            'album_art':   item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
            'popularity':  item.get('popularity', 0),
            'release_date': item.get('album', {}).get('release_date', ''),
            'spotify_url': item.get('external_urls', {}).get('spotify'),
        })

    # ── Merge recently played + saved tracks ───────────────────────────────────
    recent_tracks: list[dict] = []
    saved_tracks: list[dict] = []
    seen_ids: set[str] = {t['id'] for t in top_tracks if t.get('id')}

    for entry in (recently_played_raw.get('items') or []):
        item = entry.get('track') if isinstance(entry, dict) and 'track' in entry else entry
        if not item or not item.get('id') or item['id'] in seen_ids:
            continue
        seen_ids.add(item['id'])
        recent_tracks.append({
            'id':          item.get('id'),
            'title':       item.get('name'),
            'artist':      item['artists'][0]['name'] if item.get('artists') else '',
            'album_art':   item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
            'popularity':  item.get('popularity', 0),
            'release_date': item.get('album', {}).get('release_date', ''),
        })

    for entry in (saved_tracks_raw.get('items') or []):
        item = entry.get('track') if isinstance(entry, dict) and 'track' in entry else entry
        if not item or not item.get('id'):
            continue
        saved_tracks.append({
            'id':          item.get('id'),
            'title':       item.get('name'),
            'artist':      item['artists'][0]['name'] if item.get('artists') else '',
            'album_art':   item['album']['images'][0]['url'] if item.get('album', {}).get('images') else None,
            'popularity':  item.get('popularity', 0),
            'release_date': item.get('album', {}).get('release_date', ''),
        })

    all_tracks = top_tracks + recent_tracks + [track for track in saved_tracks if track.get('id') not in seen_ids]

    # ── Audio features ─────────────────────────────────────────────────────────
    track_ids = [t['id'] for t in all_tracks if t.get('id')][:50]
    audio_features_list: list[dict] = []
    if track_ids:
        try:
            r = req.get(
                f'{SPOTIFY}/audio-features',
                headers=headers,
                params={'ids': ','.join(track_ids)},
                timeout=10,
            )
            if r.ok:
                for f in (r.json().get('audio_features') or []):
                    if not f:
                        continue
                    audio_features_list.append({
                        'id':               f.get('id'),
                        'energy':           f.get('energy'),
                        'valence':          f.get('valence'),
                        'danceability':     f.get('danceability'),
                        'acousticness':     f.get('acousticness'),
                        'instrumentalness': f.get('instrumentalness'),
                        'speechiness':      f.get('speechiness'),
                        'tempo':            f.get('tempo'),
                        'loudness':         f.get('loudness'),
                    })
        except Exception:
            pass

    # ── Average audio features ─────────────────────────────────────────────────
    af_keys = ['energy', 'valence', 'danceability', 'acousticness',
               'tempo', 'speechiness', 'instrumentalness', 'loudness']
    avg_features: dict[str, float | None] = {}
    for key in af_keys:
        avg_value = _avg(audio_features_list, key)
        avg_features[key] = round(avg_value, 4) if avg_value is not None else None

    # Attach audio features to tracks for downstream use
    af_by_id = {f['id']: f for f in audio_features_list if f.get('id')}
    for t in top_tracks:
        t['audio_features'] = af_by_id.get(t.get('id'), {})

    # ── Derived data ───────────────────────────────────────────────────────────
    genres         = _extract_genres(top_artists)
    aesthetic_tags = _build_aesthetic_tags(
        genres,
        avg_features.get('energy'),
        avg_features.get('valence'),
    )
    galaxy_nodes   = _build_galaxy_nodes(top_artists, genres, avg_features)
    analytics      = _build_analytics(genres, avg_features, top_tracks)
    analytics      = _build_metric_metadata(audio_features_list, len(track_ids), genres, analytics, top_tracks)
    audio_coverage = round(len(audio_features_list) / len(track_ids), 3) if track_ids else 0.0
    feature_coverage_by_metric = {
        key: {
            'count': _count_present(audio_features_list, key),
            'requested': len(track_ids),
            'ratio': round((_count_present(audio_features_list, key) / len(track_ids)), 3) if track_ids else 0.0,
        }
        for key in ['energy', 'valence', 'danceability', 'acousticness', 'tempo', 'speechiness', 'instrumentalness', 'loudness']
    }
    confidence = {
        'analytics': _confidence_from_ratio(audio_coverage),
        'identity': _confidence_from_ratio(min(audio_coverage, len(genres) / 12 if genres else 0.0)),
        'galaxy': _confidence_from_ratio(min(1.0, (len(top_artists) / 50) * 0.7 + (len(genres) / 12) * 0.3)),
        'soulmate': _confidence_from_ratio(min(1.0, (len(top_artists) / 50) * 0.5 + audio_coverage * 0.5)),
    }
    confidence['overall'] = _confidence_from_ratio(
        (confidence['analytics']['score'] + confidence['identity']['score'] + confidence['galaxy']['score']) / 3
    )
    degraded_reasons = []
    if len(top_artists) < min(limit, 50):
        degraded_reasons.append('top_artists_below_requested_limit')
    if len(top_tracks) < min(limit, 50):
        degraded_reasons.append('top_tracks_below_requested_limit')
    if audio_coverage == 0:
        degraded_reasons.append('spotify_audio_features_unavailable')
    elif audio_coverage < 0.6:
        degraded_reasons.append('spotify_audio_feature_coverage_low')
    if not genres:
        degraded_reasons.append('genre_extraction_unavailable')

    identity_readiness = {
        'ready': confidence['identity']['score'] >= 0.2 and bool(genres),
        'confidence': confidence['identity'],
        'reasons': [] if confidence['identity']['score'] >= 0.2 and bool(genres) else ['insufficient_identity_inputs'],
    }
    analytics_readiness = {
        'ready': confidence['analytics']['score'] >= 0.35,
        'confidence': confidence['analytics'],
        'reasons': [] if confidence['analytics']['score'] >= 0.35 else ['insufficient_audio_feature_coverage'],
    }
    soulmate_readiness = {
        'ready': confidence['soulmate']['score'] >= 0.35 and len(top_artists) >= 10,
        'confidence': confidence['soulmate'],
        'reasons': [] if confidence['soulmate']['score'] >= 0.35 and len(top_artists) >= 10 else ['insufficient_overlap_inputs'],
    }
    data_quality = {
        'provider': 'spotify',
        'topArtistsCount': len(top_artists),
        'topTracksCount': len(top_tracks),
        'genresCount': len(genres),
        'audioFeaturesRequested': len(track_ids),
        'audioFeaturesCount': len(audio_features_list),
        'audioCoverage': audio_coverage,
        'hasAudioProfile': len(audio_features_list) > 0,
        'degradedReasons': degraded_reasons,
        'sampleSizes': analytics.get('sampleSizes', {}),
        'featureCoverageByMetric': feature_coverage_by_metric,
        'confidence': confidence,
    }

    # ── User profile ───────────────────────────────────────────────────────────
    images = user_profile_raw.get('images') or []
    user_profile = {
        'id':        user_profile_raw.get('id'),
        'name':      user_profile_raw.get('display_name'),
        'email':     user_profile_raw.get('email'),
        'image':     images[0]['url'] if images else None,
        'country':   user_profile_raw.get('country'),
        'product':   user_profile_raw.get('product'),
        'followers': user_profile_raw.get('followers', {}).get('total', 0),
    } if user_profile_raw else {}

    return {
        'profileSchemaVersion': PROFILE_SCHEMA_VERSION,
        'generatedAt':       datetime.now(timezone.utc).isoformat(),
        'syncedAt':          datetime.now(timezone.utc).isoformat(),
        'userProfile':       user_profile,
        'topArtists':        top_artists,
        'topTracks':         top_tracks,
        'recentlyPlayed':    recent_tracks[:25],
        'savedTracks':       saved_tracks[:25],
        'audioFeatures':     avg_features,
        'audioFeaturesList': audio_features_list,
        'galaxyNodes':       galaxy_nodes,
        'aestheticTags':     aesthetic_tags,
        'analyticsMetrics':  analytics,
        'genres':            genres,
        'timeRange':         time_range,
        'dataQuality':       data_quality,
        'confidence':        confidence,
        'analyticsReadiness': analytics_readiness,
        'identityReadiness': identity_readiness,
        'soulmateReadiness': soulmate_readiness,
    }

"""
music_vector.py — Music Vector Middleware
------------------------------------------
Merges Spotify audio_features with Last.fm genre/mood tags into a single
enriched "Music Vector" object used across the recommendation and similarity
engines.

Music Vector schema
───────────────────
{
  "track_id":      str,
  "title":         str,
  "artist":        str,
  "audio_features": {
    "energy":           float,   # 0–1
    "valence":          float,   # 0–1
    "danceability":     float,   # 0–1
    "tempo":            float,   # BPM
    "acousticness":     float,
    "instrumentalness": float,
    "speechiness":      float,
    "loudness":         float,
  },
  "sentiment": {
    "label":  str,   # "positive" | "negative" | "neutral" | "intense"
    "score":  float, # 0–1 confidence
  },
  "tags":          list[str],   # Last.fm genre/mood tags
  "mood_vector":   list[float], # [energy, valence, danceability, tempo_norm]
  "aesthetic_keyword": str,     # derived poetic keyword
}
"""

from __future__ import annotations

# ── Sentiment proxy via genre/tag NLP ─────────────────────────────────────────
# We don't have direct lyrics access, so we derive sentiment from:
#   1. Spotify valence + energy (primary signal)
#   2. Last.fm tags (secondary signal — keyword matching)

_POSITIVE_TAGS = {
    'happy', 'upbeat', 'feel-good', 'euphoric', 'joyful', 'uplifting',
    'summer', 'dance', 'party', 'fun', 'cheerful', 'bright', 'optimistic',
}
_NEGATIVE_TAGS = {
    'sad', 'melancholic', 'depressing', 'dark', 'gloomy', 'heartbreak',
    'grief', 'lonely', 'somber', 'tragic', 'mournful', 'bleak',
}
_INTENSE_TAGS = {
    'aggressive', 'intense', 'heavy', 'metal', 'hardcore', 'rage',
    'angry', 'brutal', 'powerful', 'explosive', 'raw',
}

# Poetic aesthetic keywords derived from [valence, energy] quadrant
_AESTHETIC_MAP = [
    # (energy_min, energy_max, valence_min, valence_max, keyword)
    (0.65, 1.0,  0.65, 1.0,  'Electric Citrus'),
    (0.65, 1.0,  0.0,  0.4,  'Neon Storm'),
    (0.0,  0.4,  0.65, 1.0,  'Pastel Reverie'),
    (0.0,  0.4,  0.0,  0.4,  'Midnight Obsidian'),
    (0.4,  0.65, 0.5,  1.0,  'Golden Drift'),
    (0.4,  0.65, 0.0,  0.5,  'Velvet Haze'),
]


def _derive_sentiment(audio_features: dict, tags: list[str]) -> dict:
    """
    Derive a sentiment label + confidence from audio features and tags.
    Primary signal: valence + energy.
    Secondary signal: tag keyword matching.
    """
    valence = float(audio_features.get('valence', 0.5) or 0.5)
    energy  = float(audio_features.get('energy',  0.5) or 0.5)

    tag_set = {t.lower().strip() for t in tags}

    # Tag-based override
    pos_hits = len(tag_set & _POSITIVE_TAGS)
    neg_hits = len(tag_set & _NEGATIVE_TAGS)
    int_hits = len(tag_set & _INTENSE_TAGS)

    if int_hits > 0 and energy > 0.65:
        return {'label': 'intense', 'score': min(0.5 + energy * 0.5, 1.0)}

    if pos_hits > neg_hits and valence > 0.5:
        score = min(0.4 + valence * 0.6 + pos_hits * 0.05, 1.0)
        return {'label': 'positive', 'score': round(score, 3)}

    if neg_hits > pos_hits and valence < 0.5:
        score = min(0.4 + (1 - valence) * 0.6 + neg_hits * 0.05, 1.0)
        return {'label': 'negative', 'score': round(score, 3)}

    # Fall back to pure audio features
    if valence >= 0.6 and energy >= 0.5:
        return {'label': 'positive', 'score': round(valence * 0.7 + energy * 0.3, 3)}
    if valence <= 0.4 and energy <= 0.5:
        return {'label': 'negative', 'score': round((1 - valence) * 0.7 + (1 - energy) * 0.3, 3)}
    return {'label': 'neutral', 'score': 0.5}


def _derive_aesthetic_keyword(audio_features: dict) -> str:
    energy  = float(audio_features.get('energy',  0.5) or 0.5)
    valence = float(audio_features.get('valence', 0.5) or 0.5)
    for e_min, e_max, v_min, v_max, keyword in _AESTHETIC_MAP:
        if e_min <= energy <= e_max and v_min <= valence <= v_max:
            return keyword
    return 'Cosmic Drift'


def build_music_vector(
    track_id: str,
    title: str,
    artist: str,
    audio_features: dict,
    lastfm_tags: list[str] | None = None,
) -> dict:
    """
    Merge Spotify audio_features + Last.fm tags into a unified Music Vector.

    Parameters
    ----------
    track_id       : Spotify track ID or any unique identifier
    title          : Track title
    artist         : Primary artist name
    audio_features : Spotify audio_features dict
    lastfm_tags    : List of Last.fm tag strings (optional)

    Returns
    -------
    dict — the enriched Music Vector
    """
    tags = lastfm_tags or []
    af   = audio_features or {}

    tempo_norm = min(float(af.get('tempo', 120) or 120) / 200.0, 1.0)

    return {
        'track_id':   track_id,
        'title':      title,
        'artist':     artist,
        'audio_features': {
            'energy':           float(af.get('energy',           0.5) or 0.5),
            'valence':          float(af.get('valence',          0.5) or 0.5),
            'danceability':     float(af.get('danceability',     0.5) or 0.5),
            'tempo':            float(af.get('tempo',            120) or 120),
            'acousticness':     float(af.get('acousticness',     0.0) or 0.0),
            'instrumentalness': float(af.get('instrumentalness', 0.0) or 0.0),
            'speechiness':      float(af.get('speechiness',      0.0) or 0.0),
            'loudness':         float(af.get('loudness',         -10) or -10),
        },
        'sentiment':         _derive_sentiment(af, tags),
        'tags':              tags,
        'mood_vector':       [
            float(af.get('energy',       0.5) or 0.5),
            float(af.get('valence',      0.5) or 0.5),
            float(af.get('danceability', 0.5) or 0.5),
            tempo_norm,
        ],
        # 3D spatial coordinate [X=Valence, Y=Energy, Z=Acousticness]
        # Scaled to [-10, +10] world-space so the Galaxy fills the scene.
        'coords_3d': {
            'x': (float(af.get('valence',      0.5) or 0.5) - 0.5) * 20,
            'y': (float(af.get('energy',       0.5) or 0.5) - 0.5) * 20,
            'z': (float(af.get('acousticness', 0.5) or 0.5) - 0.5) * 20,
        },
        'aesthetic_keyword': _derive_aesthetic_keyword(af),
    }


def build_music_vectors_batch(tracks: list[dict]) -> list[dict]:
    """
    Build Music Vectors for a list of track dicts.

    Each dict should have:
      id / track_id, title / name, artist,
      audio_features (dict), lastfm_tags (list, optional)
    """
    vectors = []
    for t in tracks:
        tid    = t.get('id') or t.get('track_id') or ''
        title  = t.get('title') or t.get('name') or ''
        artist = t.get('artist') or ''
        af     = t.get('audio_features') or {}
        tags   = t.get('lastfm_tags') or t.get('tags') or []
        vectors.append(build_music_vector(tid, title, artist, af, tags))
    return vectors

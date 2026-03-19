"""
Music Soulmate Engine
---------------------
Computes taste compatibility between two users based on:
  - Artist overlap   (40%) — Jaccard similarity on top artist sets
  - Genre overlap    (25%) — Jaccard similarity on genre sets
  - Audio features   (20%) — cosine similarity on mean feature vectors
  - Track overlap    (10%) — Jaccard similarity on top track sets
  - Vibe similarity  ( 5%) — mood/energy distance between profiles

Final score is 0–100.
"""

from __future__ import annotations
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

AUDIO_KEYS = ['energy', 'valence', 'danceability', 'acousticness',
              'instrumentalness', 'speechiness']

WEIGHTS = {
    'artists': 0.40,
    'genres':  0.25,
    'audio':   0.20,
    'tracks':  0.10,
    'vibe':    0.05,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _jaccard(set_a: set, set_b: set) -> float:
    """Jaccard similarity: |A ∩ B| / |A ∪ B|"""
    if not set_a and not set_b:
        return 0.0
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


def _audio_vector(profile: dict) -> np.ndarray:
    """Build a normalised audio feature vector from a taste profile dict."""
    return np.array([float(profile.get(k, 0) or 0) for k in AUDIO_KEYS], dtype=np.float32)


def _normalise_names(items: list[str]) -> set[str]:
    return {s.strip().lower() for s in items if s}


# ── Main engine ────────────────────────────────────────────────────────────────

class SoulmateEngine:

    def compute_score(self, profile_a: dict, profile_b: dict) -> dict:
        """
        Compare two taste profiles and return a full compatibility report.

        Each profile should contain:
          artists: list[str]
          tracks:  list[str]
          genres:  list[str]
          audio:   dict  (mean audio features)
        """
        artists_a = _normalise_names(profile_a.get('artists', []))
        artists_b = _normalise_names(profile_b.get('artists', []))
        tracks_a  = _normalise_names(profile_a.get('tracks',  []))
        tracks_b  = _normalise_names(profile_b.get('tracks',  []))
        genres_a  = _normalise_names(profile_a.get('genres',  []))
        genres_b  = _normalise_names(profile_b.get('genres',  []))

        artist_sim = _jaccard(artists_a, artists_b)
        track_sim  = _jaccard(tracks_a,  tracks_b)
        genre_sim  = _jaccard(genres_a,  genres_b)

        # Audio cosine similarity
        vec_a = _audio_vector(profile_a.get('audio', {}))
        vec_b = _audio_vector(profile_b.get('audio', {}))
        if np.any(vec_a) and np.any(vec_b):
            audio_sim = float(cosine_similarity([vec_a], [vec_b])[0][0])
        else:
            audio_sim = 0.0

        # Vibe similarity — mood/energy proximity (1 - normalised distance)
        mood_a = profile_a.get('mood', {}) or profile_a.get('audio', {})
        mood_b = profile_b.get('mood', {}) or profile_b.get('audio', {})
        e_diff = abs(float(mood_a.get('energy', 0.5) or 0.5) - float(mood_b.get('energy', 0.5) or 0.5))
        v_diff = abs(float(mood_a.get('valence', 0.5) or 0.5) - float(mood_b.get('valence', 0.5) or 0.5))
        vibe_sim = max(0.0, 1.0 - (e_diff + v_diff) / 2.0)

        raw_score = (
            artist_sim * WEIGHTS['artists'] +
            genre_sim  * WEIGHTS['genres']  +
            audio_sim  * WEIGHTS['audio']   +
            track_sim  * WEIGHTS['tracks']  +
            vibe_sim   * WEIGHTS['vibe']
        )
        match_score = round(raw_score * 100)

        shared_artists = sorted(artists_a & artists_b)
        shared_tracks  = sorted(tracks_a  & tracks_b)
        shared_genres  = sorted(genres_a  & genres_b)

        return {
            'match_score':     match_score,
            'shared_artists':  shared_artists,
            'shared_tracks':   shared_tracks,
            'shared_genres':   shared_genres,
            'breakdown': {
                'artists': round(artist_sim * 100),
                'genres':  round(genre_sim  * 100),
                'audio':   round(audio_sim  * 100),
                'tracks':  round(track_sim  * 100),
                'vibe':    round(vibe_sim   * 100),
            },
        }

    def rank_matches(self, user_profile: dict, all_profiles: list[dict]) -> list[dict]:
        """
        Rank a list of other user profiles by compatibility with `user_profile`.
        Each item in all_profiles must have a 'user_id' and 'username' key.
        Returns list sorted by match_score descending.
        """
        results = []
        for other in all_profiles:
            result = self.compute_score(user_profile, other)
            results.append({
                'user_id':       other.get('user_id'),
                'username':      other.get('username', 'Unknown'),
                'avatar':        other.get('avatar'),
                'match_score':   result['match_score'],
                'shared_artists': result['shared_artists'][:3],
                'shared_genres':  result['shared_genres'][:3],
                'breakdown':     result['breakdown'],
            })
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results

    def build_constellation_graph(self, profile_a: dict, profile_b: dict,
                                  user_a_name: str = 'You',
                                  user_b_name: str = 'Soulmate') -> dict:
        """
        Build a graph data structure for the constellation visualisation.

        Returns:
          nodes: list of { id, label, type, image }
            type: 'shared' | 'user_a' | 'user_b'
          links: list of { source, target, strength }
        """
        artists_a = {a.strip().lower(): a.strip() for a in profile_a.get('artists', [])}
        artists_b = {a.strip().lower(): a.strip() for a in profile_b.get('artists', [])}

        shared_keys = set(artists_a) & set(artists_b)
        only_a      = set(artists_a) - shared_keys
        only_b      = set(artists_b) - shared_keys

        nodes = []
        links = []

        # Shared artists — bright centre nodes
        for key in list(shared_keys)[:12]:
            nodes.append({'id': key, 'label': artists_a[key], 'type': 'shared', 'image': None})

        # User A exclusive
        for key in list(only_a)[:10]:
            nodes.append({'id': f'a_{key}', 'label': artists_a[key], 'type': 'user_a', 'image': None})

        # User B exclusive
        for key in list(only_b)[:10]:
            nodes.append({'id': f'b_{key}', 'label': artists_b[key], 'type': 'user_b', 'image': None})

        # Links: exclusive artists → nearest shared artist
        shared_list = [n['id'] for n in nodes if n['type'] == 'shared']
        for node in nodes:
            if node['type'] == 'user_a' and shared_list:
                links.append({'source': node['id'], 'target': shared_list[0], 'strength': 0.3})
            elif node['type'] == 'user_b' and shared_list:
                links.append({'source': node['id'], 'target': shared_list[0], 'strength': 0.3})

        # Links between shared artists
        for i in range(len(shared_list) - 1):
            links.append({'source': shared_list[i], 'target': shared_list[i + 1], 'strength': 0.8})

        return {'nodes': nodes, 'links': links}


soulmate_engine = SoulmateEngine()

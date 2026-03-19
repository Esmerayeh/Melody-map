"""
Recommendation Engine
---------------------
Implements five strategies:
  1. Content-based filtering  — cosine similarity on audio features
  2. Collaborative filtering  — user-item overlap (lightweight)
  3. KNN-based               — sklearn NearestNeighbors on feature space
  4. Hybrid                  — weighted blend of content + collaborative
  5. Mood playlist            — hard-filter on audio feature ranges

Intelligence Layer
------------------
Integrates with music_vector.py to consume enriched Music Vectors that
include sentiment analysis (derived from valence/energy + Last.fm tags)
and aesthetic keywords. Sentiment is used to boost/penalise recommendations
based on emotional alignment with the user's current vibe.
"""

import numpy as np
from collections import defaultdict
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors

FEATURE_KEYS = [
    'tempo', 'energy', 'danceability', 'valence',
    'acousticness', 'instrumentalness', 'loudness', 'speechiness',
]

# Normalise loudness from dB range [-60, 0] → [0, 1]
def _normalise_loudness(v: float) -> float:
    return max(0.0, min(1.0, (v + 60) / 60))

def _song_vector(song: dict) -> np.ndarray:
    af = song.get('audio_features') or {}
    vec = []
    for k in FEATURE_KEYS:
        v = float(af.get(k, 0) or 0)
        if k == 'loudness':
            v = _normalise_loudness(v)
        elif k == 'tempo':
            v = min(v / 200.0, 1.0)   # normalise BPM to [0,1]
        vec.append(v)
    return np.array(vec, dtype=np.float32)


class RecommendationEngine:
    def __init__(self):
        self._knn: NearestNeighbors | None = None
        self._knn_songs: list = []

    # ------------------------------------------------------------------
    # User profile
    # ------------------------------------------------------------------
    def build_user_profile(self, interactions: list, songs_data: list) -> dict | None:
        liked = [i for i in interactions if i.get('interaction_type') in ('like', 'play', 'save')]
        if not liked:
            return None

        song_map = {str(s.get('_id')): s for s in songs_data}
        sums: dict = defaultdict(float)
        count = 0

        for interaction in liked:
            song = song_map.get(str(interaction.get('song_id')))
            if song and song.get('audio_features'):
                for k, v in song['audio_features'].items():
                    if isinstance(v, (int, float)):
                        sums[k] += float(v)
                count += 1

        if count == 0:
            return None
        return {k: v / count for k, v in sums.items()}

    # ------------------------------------------------------------------
    # Sentiment-aware content-based filtering
    # ------------------------------------------------------------------
    def sentiment_aware_filtering(self, user_profile: dict | None, songs_data: list,
                                   target_sentiment: str | None = None, top_k: int = 20) -> list:
        """
        Content-based filtering with a sentiment alignment bonus.

        If target_sentiment is provided (e.g. 'positive', 'negative', 'intense'),
        songs whose sentiment label matches get a +0.1 score boost.
        Songs with a Music Vector aesthetic_keyword are also surfaced first.
        """
        if not user_profile:
            return []

        profile_vec = _song_vector({'audio_features': user_profile})
        results = []

        for song in songs_data:
            song_vec = _song_vector(song)
            score = float(cosine_similarity([profile_vec], [song_vec])[0][0])

            # Sentiment alignment bonus
            sentiment = song.get('sentiment') or {}
            if target_sentiment and sentiment.get('label') == target_sentiment:
                score += 0.10 * float(sentiment.get('score', 0.5))

            # Aesthetic keyword presence bonus (Music Vector enriched songs)
            if song.get('aesthetic_keyword'):
                score += 0.02

            results.append({'song_id': str(song.get('_id') or song.get('track_id', '')),
                             'score': score, 'song': song})

        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def music_vector_recommend(self, music_vectors: list, target_vector: dict, top_k: int = 20) -> list:
        """
        Recommend from a list of Music Vectors (output of build_music_vectors_batch)
        against a target Music Vector (the user's mean profile).

        Uses cosine similarity on mood_vector [energy, valence, danceability, tempo_norm]
        with a sentiment alignment bonus.
        """
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity as cos_sim

        target_mv = target_vector.get('mood_vector') or [0.5, 0.5, 0.5, 0.6]
        target_arr = np.array(target_mv, dtype=np.float32).reshape(1, -1)
        target_sentiment = (target_vector.get('sentiment') or {}).get('label')

        results = []
        for mv in music_vectors:
            mv_arr = np.array(mv.get('mood_vector', [0.5, 0.5, 0.5, 0.6]), dtype=np.float32).reshape(1, -1)
            score = float(cos_sim(target_arr, mv_arr)[0][0])

            # Sentiment alignment bonus
            if target_sentiment and (mv.get('sentiment') or {}).get('label') == target_sentiment:
                score += 0.08

            results.append({
                'track_id': mv.get('track_id', ''),
                'title':    mv.get('title', ''),
                'artist':   mv.get('artist', ''),
                'score':    round(score, 4),
                'aesthetic_keyword': mv.get('aesthetic_keyword', ''),
                'sentiment': mv.get('sentiment', {}),
            })

        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # Content-based filtering
    # ------------------------------------------------------------------
    def content_based_filtering(self, user_profile: dict | None, songs_data: list, top_k: int = 20) -> list:
        if not user_profile:
            return []

        profile_vec = _song_vector({'audio_features': user_profile})
        results = []

        for song in songs_data:
            song_vec = _song_vector(song)
            score = float(cosine_similarity([profile_vec], [song_vec])[0][0])
            results.append({'song_id': str(song.get('_id')), 'score': score, 'song': song})

        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # KNN-based recommendations
    # ------------------------------------------------------------------
    def fit_knn(self, songs_data: list, n_neighbors: int = 11) -> None:
        """Fit a KNN model on the song corpus. Call once after loading songs."""
        if len(songs_data) < n_neighbors:
            return
        self._knn_songs = songs_data
        X = np.array([_song_vector(s) for s in songs_data])
        self._knn = NearestNeighbors(n_neighbors=n_neighbors, metric='cosine', algorithm='brute')
        self._knn.fit(X)

    def knn_similar(self, song: dict, top_k: int = 10) -> list:
        """Return top_k songs most similar to `song` using the fitted KNN model."""
        if self._knn is None or not self._knn_songs:
            return []
        vec = _song_vector(song).reshape(1, -1)
        distances, indices = self._knn.kneighbors(vec, n_neighbors=min(top_k + 1, len(self._knn_songs)))
        results = []
        for dist, idx in zip(distances[0][1:], indices[0][1:]):   # skip self
            s = self._knn_songs[idx]
            results.append({'song_id': str(s.get('_id')), 'score': float(1 - dist), 'song': s})
        return results

    # ------------------------------------------------------------------
    # Collaborative filtering (lightweight user-item)
    # ------------------------------------------------------------------
    def collaborative_filtering(self, user_id: str, all_interactions: list, songs_data: list, top_k: int = 20) -> list:
        user_songs = {str(i.get('song_id')) for i in all_interactions if str(i.get('user_id')) == str(user_id)}
        if not user_songs:
            return []

        candidate_scores: dict = defaultdict(int)
        for interaction in all_interactions:
            if str(interaction.get('user_id')) == str(user_id):
                continue
            if str(interaction.get('song_id')) in user_songs:
                other_uid = str(interaction.get('user_id'))
                for other in all_interactions:
                    if str(other.get('user_id')) == other_uid and str(other.get('song_id')) not in user_songs:
                        candidate_scores[str(other.get('song_id'))] += 1

        top = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{'song_id': sid, 'score': float(sc)} for sid, sc in top]

    # ------------------------------------------------------------------
    # Hybrid
    # ------------------------------------------------------------------
    def hybrid_recommendation(self, user_id: str, user_profile: dict | None,
                               all_interactions: list, songs_data: list, top_k: int = 20) -> list:
        content = self.content_based_filtering(user_profile, songs_data, top_k * 2)
        collab  = self.collaborative_filtering(user_id, all_interactions, songs_data, top_k * 2)

        combined: dict = defaultdict(float)
        for r in content:
            combined[r['song_id']] += r['score'] * 0.65
        for r in collab:
            combined[r['song_id']] += r['score'] * 0.35

        top = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{'song_id': sid, 'score': sc} for sid, sc in top]

    # ------------------------------------------------------------------
    # Mood playlist
    # ------------------------------------------------------------------
    MOOD_CRITERIA: dict = {
        'happy':       {'valence': (0.6, 1.0), 'energy': (0.5, 1.0)},
        'sad':         {'valence': (0.0, 0.4), 'energy': (0.0, 0.5)},
        'energetic':   {'energy': (0.7, 1.0),  'danceability': (0.6, 1.0)},
        'calm':        {'energy': (0.0, 0.4),  'acousticness': (0.5, 1.0)},
        'dreamy':      {'valence': (0.4, 0.7), 'acousticness': (0.4, 0.8), 'energy': (0.2, 0.6)},
        'melancholic': {'valence': (0.0, 0.4), 'acousticness': (0.3, 0.8)},
        'nostalgic':   {'valence': (0.3, 0.6), 'acousticness': (0.4, 0.9)},
        'focus':       {'instrumentalness': (0.3, 1.0), 'energy': (0.3, 0.7)},
        'party':       {'danceability': (0.7, 1.0), 'energy': (0.7, 1.0), 'valence': (0.5, 1.0)},
    }

    def generate_mood_playlist(self, mood: str, songs_data: list, playlist_size: int = 20) -> list:
        criteria = self.MOOD_CRITERIA.get(mood)
        if not criteria:
            return []

        scored = []
        for song in songs_data:
            af = song.get('audio_features') or {}
            score = 0.0
            match = True
            for feature, (lo, hi) in criteria.items():
                val = float(af.get(feature, 0) or 0)
                if feature == 'loudness':
                    val = _normalise_loudness(val)
                if not (lo <= val <= hi):
                    match = False
                    break
                # Reward songs closer to the centre of the range
                centre = (lo + hi) / 2
                score += 1.0 - abs(val - centre) / ((hi - lo) / 2 + 1e-9)
            if match:
                scored.append((score, song))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [s for _, s in scored[:playlist_size]]

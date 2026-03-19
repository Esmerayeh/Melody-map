import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from config import Config

class SpotifyService:
    def __init__(self):
        if Config.SPOTIFY_CLIENT_ID and Config.SPOTIFY_CLIENT_SECRET:
            auth_manager = SpotifyClientCredentials(
                client_id=Config.SPOTIFY_CLIENT_ID,
                client_secret=Config.SPOTIFY_CLIENT_SECRET
            )
            self.sp = spotipy.Spotify(auth_manager=auth_manager)
        else:
            self.sp = None
    
    def get_track_features(self, track_id):
        """Get audio features for a track"""
        if not self.sp:
            return None
        
        try:
            features = self.sp.audio_features([track_id])[0]
            track = self.sp.track(track_id)
            
            return {
                'spotify_id': track_id,
                'title': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'duration_ms': track['duration_ms'],
                'popularity': track['popularity'],
                'preview_url': track['preview_url'],
                'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'audio_features': {
                    'tempo': features['tempo'],
                    'energy': features['energy'],
                    'danceability': features['danceability'],
                    'valence': features['valence'],
                    'acousticness': features['acousticness'],
                    'instrumentalness': features['instrumentalness'],
                    'loudness': features['loudness'],
                    'speechiness': features['speechiness'],
                    'liveness': features['liveness'],
                    'key': features['key'],
                    'mode': features['mode'],
                    'time_signature': features['time_signature']
                }
            }
        except Exception as e:
            print(f"Error fetching track features: {e}")
            return None
    
    def get_audio_features_batch(self, track_ids: list) -> list:
        """
        Fetch audio features for up to 100 tracks in a single API call.
        Returns a list of feature dicts, skipping null entries.
        """
        if not self.sp or not track_ids:
            return []
        try:
            # Spotify allows max 100 IDs per request
            results = self.sp.audio_features(track_ids[:100])
            features = []
            for f in results:
                if not f:
                    continue
                features.append({
                    'spotify_id':        f['id'],
                    'tempo':             f.get('tempo', 0),
                    'energy':            f.get('energy', 0),
                    'danceability':      f.get('danceability', 0),
                    'valence':           f.get('valence', 0),
                    'acousticness':      f.get('acousticness', 0),
                    'instrumentalness':  f.get('instrumentalness', 0),
                    'loudness':          f.get('loudness', 0),
                    'speechiness':       f.get('speechiness', 0),
                    'liveness':          f.get('liveness', 0),
                    'key':               f.get('key', 0),
                    'mode':              f.get('mode', 0),
                    'time_signature':    f.get('time_signature', 4),
                })
            return features
        except Exception as e:
            print(f"Error fetching batch audio features: {e}")
            return []

    def search_tracks(self, query, limit=20):
        """Search for tracks"""
        if not self.sp:
            return []
        
        try:
            results = self.sp.search(q=query, type='track', limit=limit)
            return results['tracks']['items']
        except Exception as e:
            print(f"Error searching tracks: {e}")
            return []
    
    def get_artist_info(self, artist_id):
        """Get artist information"""
        if not self.sp:
            return None
        
        try:
            artist = self.sp.artist(artist_id)
            return {
                'spotify_id': artist_id,
                'name': artist['name'],
                'genres': artist['genres'],
                'popularity': artist['popularity'],
                'followers': artist['followers']['total'],
                'image_url': artist['images'][0]['url'] if artist['images'] else None
            }
        except Exception as e:
            print(f"Error fetching artist info: {e}")
            return None

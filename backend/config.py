import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/melody_map')
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
    SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
    # Spotify OAuth redirect URI.
    # Post-April 2025: Spotify no longer accepts "localhost" — use loopback IP literals.
    # Local dev:   http://127.0.0.1:<PORT>/auth/spotify/callback
    # Production:  https://yourdomain.com/auth/spotify/callback
    SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:5000/auth/spotify/callback')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://127.0.0.1:3000')
    LASTFM_API_KEY    = os.getenv('LASTFM_API_KEY')
    LASTFM_API_SECRET = os.getenv('LASTFM_API_SECRET')
    UNSPLASH_ACCESS_KEY    = os.getenv('UNSPLASH_ACCESS_KEY')
    PINTEREST_ACCESS_TOKEN = os.getenv('PINTEREST_ACCESS_TOKEN')
    PORT = int(os.getenv('PORT', 5000))

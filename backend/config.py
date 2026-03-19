import os
from urllib.parse import quote_plus, urlparse, urlunparse
from dotenv import load_dotenv

load_dotenv()

def _build_mongo_uri() -> str:
    """
    Read MONGODB_URI from env and ensure credentials are RFC-3986 encoded.
    Passwords with special characters like '@', '/', ':' break URI parsing
    unless percent-encoded (e.g. '@' → '%40').
    """
    uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/melody_map')

    try:
        parsed = urlparse(uri)
        if parsed.username or parsed.password:
            safe_user = quote_plus(parsed.username or '')
            safe_pass = quote_plus(parsed.password or '')
            host_part = parsed.hostname
            if parsed.port:
                host_part = f"{host_part}:{parsed.port}"
            safe_netloc = f"{safe_user}:{safe_pass}@{host_part}"
            uri = urlunparse(parsed._replace(netloc=safe_netloc))
    except Exception:
        pass

    return uri


class Config:
    MONGODB_URI            = _build_mongo_uri()
    SECRET_KEY             = os.getenv('SECRET_KEY', 'dev-secret-key')
    SPOTIFY_CLIENT_ID      = os.getenv('SPOTIFY_CLIENT_ID')
    SPOTIFY_CLIENT_SECRET  = os.getenv('SPOTIFY_CLIENT_SECRET')
    SPOTIFY_REDIRECT_URI   = os.getenv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:5000/auth/spotify/callback')
    FRONTEND_URL           = os.getenv('FRONTEND_URL', 'http://127.0.0.1:3000')
    LASTFM_API_KEY         = os.getenv('LASTFM_API_KEY')
    LASTFM_API_SECRET      = os.getenv('LASTFM_API_SECRET')
    UNSPLASH_ACCESS_KEY    = os.getenv('UNSPLASH_ACCESS_KEY')
    PINTEREST_ACCESS_TOKEN = os.getenv('PINTEREST_ACCESS_TOKEN')
    PORT                   = int(os.getenv('PORT', 5000))

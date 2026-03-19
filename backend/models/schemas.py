from datetime import datetime

# MongoDB Schema Definitions

USER_SCHEMA = {
    "_id": "ObjectId",
    "username": "string",
    "email": "string",
    "password_hash": "string",
    "created_at": "datetime",
    "taste_profile": {
        "favorite_genres": ["string"],
        "top_artists": ["string"],
        "audio_preferences": {
            "energy": "float",
            "valence": "float",
            "danceability": "float",
            "acousticness": "float"
        }
    },
    "playlists": ["ObjectId"]
}

SONG_SCHEMA = {
    "_id": "ObjectId",
    "spotify_id": "string",
    "title": "string",
    "artist": "string",
    "album": "string",
    "duration_ms": "int",
    "audio_features": {
        "tempo": "float",
        "energy": "float",
        "danceability": "float",
        "valence": "float",
        "acousticness": "float",
        "instrumentalness": "float",
        "loudness": "float",
        "speechiness": "float",
        "liveness": "float",
        "key": "int",
        "mode": "int",
        "time_signature": "int"
    },
    "cluster_id": "int",
    "map_coordinates": {
        "x": "float",
        "y": "float"
    },
    "genres": ["string"],
    "popularity": "int",
    "preview_url": "string",
    "album_art": "string"
}

ARTIST_SCHEMA = {
    "_id": "ObjectId",
    "spotify_id": "string",
    "name": "string",
    "genres": ["string"],
    "popularity": "int",
    "followers": "int",
    "image_url": "string",
    "similar_artists": ["ObjectId"],
    "map_coordinates": {
        "x": "float",
        "y": "float"
    }
}

PLAYLIST_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId",
    "name": "string",
    "description": "string",
    "songs": ["ObjectId"],
    "mood": "string",
    "created_at": "datetime",
    "updated_at": "datetime",
    "is_public": "boolean",
    "generated_by_ai": "boolean"
}

INTERACTION_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId",
    "song_id": "ObjectId",
    "interaction_type": "string",  # like, play, skip, save
    "timestamp": "datetime"
}

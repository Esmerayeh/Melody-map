user_profile_features_v1 = {
    "name": "user_profile_features_v1",
    "entities": ["user_id"],
    "features": ["profile_vector", "genres", "mood", "confidence_score"],
}

user_recent_signal_v1 = {
    "name": "user_recent_signal_v1",
    "entities": ["user_id"],
    "features": ["session_intensity", "novelty_score", "repeat_score", "event_count"],
}

track_catalog_features_v1 = {
    "name": "track_catalog_features_v1",
    "entities": ["track_key"],
    "features": ["popularity", "genre", "artist", "embedding_version"],
}

session_features_v1 = {
    "name": "session_features_v1",
    "entities": ["session_id"],
    "features": ["surface", "recent_event_count", "last_track_key"],
}

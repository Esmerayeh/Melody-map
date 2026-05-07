from services.auralith_memory import build_memory_chunks, retrieve_memory_chunks
from services.feature_store import register_profile_snapshot


def _profile():
    return {
        "profileSchemaVersion": "test",
        "provider": "spotify",
        "timeRange": "medium_term",
        "topArtists": [{"name": "Phoebe Bridgers", "genres": ["indie folk"]}, {"name": "Radiohead", "genres": ["alternative rock"]}],
        "topTracks": [{"title": "Motion Sickness", "artist": "Phoebe Bridgers"}],
        "genres": [{"genre": "indie folk"}, {"genre": "dream pop"}],
        "audioFeatures": {"energy": 0.32, "valence": 0.24, "danceability": 0.41},
        "analyticsMetrics": {"mood": "melancholic"},
        "personality": [{"label": "Nocturnal Dreamer"}],
        "mbti": {"type": "INFP"},
        "representations": {"profileVector": [0.2, 0.4, 0.6]},
        "confidence": {},
        "dataQuality": {},
    }


def test_build_memory_chunks_creates_multiple_source_types():
    user_id = "auralith-memory-user"
    register_profile_snapshot(_profile(), user_id=user_id)
    chunks = build_memory_chunks(user_id)
    source_types = {chunk["source_type"] for chunk in chunks}
    assert "top_track" in source_types
    assert "top_artist" in source_types
    assert "genre_pattern" in source_types
    assert "mood_summary" in source_types
    assert "identity_snapshot" in source_types


def test_retrieve_memory_chunks_returns_ranked_memories():
    user_id = "auralith-memory-search"
    register_profile_snapshot(_profile(), user_id=user_id)
    build_memory_chunks(user_id)
    result = retrieve_memory_chunks(user_id, "Why do I keep returning to melancholic indie songs?")
    assert result["chunks"]
    assert result["confidence"] > 0
    assert "mood_summary" in result["source_types"] or "genre_pattern" in result["source_types"]


def test_retrieve_memory_chunks_falls_back_when_no_profile_exists():
    result = retrieve_memory_chunks("auralith-empty-user", "Who am I lately?")
    assert result["chunks"] == []
    assert result["confidence"] == 0.18
    assert "No listening memory" in result["explanation"]

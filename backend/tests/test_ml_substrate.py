from ml.co_listen_embeddings import build_co_listen_embeddings
from ml.graph_walk_embeddings import build_graph_walk_embeddings
from services.feature_store import summarize_live_signal


def test_build_co_listen_embeddings_returns_vectors_for_tracks_and_profiles():
    events = [
        {"user_id": "u1", "track_id": "t1", "title": "Track 1", "artist": "Artist 1"},
        {"user_id": "u1", "track_id": "t2", "title": "Track 2", "artist": "Artist 2"},
        {"user_id": "u2", "track_id": "t1", "title": "Track 1", "artist": "Artist 1"},
        {"user_id": "u2", "track_id": "t3", "title": "Track 3", "artist": "Artist 3"},
    ]

    result = build_co_listen_embeddings(events, dimensions=4)

    assert result["version"]
    assert "t1" in result["trackEmbeddings"]
    assert "u1" in result["profileEmbeddings"]
    assert len(result["profileEmbeddings"]["u1"]) >= 1


def test_build_graph_walk_embeddings_returns_communities_and_vectors():
    topology = {
        "nodes": [
            {"id": "a", "label": "A", "type": "artist"},
            {"id": "b", "label": "B", "type": "artist"},
            {"id": "c", "label": "C", "type": "artist"},
        ],
        "links": [
            {"source": "a", "target": "b", "strength": 0.8},
            {"source": "b", "target": "c", "strength": 0.7},
        ],
    }

    result = build_graph_walk_embeddings(topology, dimensions=3, walks_per_node=3, walk_length=4)

    assert result["version"]
    assert result["nodeVectors"]["a"]
    assert result["communities"]
    assert result["edgeDensity"] > 0


def test_summarize_live_signal_highlights_novelty_and_repeats():
    result = summarize_live_signal_from_events([
        {"track_id": "t1", "title": "One", "artist": "A"},
        {"track_id": "t1", "title": "One", "artist": "A"},
        {"track_id": "t2", "title": "Two", "artist": "B"},
    ])

    assert result["eventCount"] == 3
    assert result["repeatScore"] > 0
    assert result["noveltyScore"] > 0


def summarize_live_signal_from_events(events):
    from services import feature_store

    original = feature_store.get_recent_events
    feature_store.get_recent_events = lambda _user_id, limit=20: events[:limit]
    try:
        return summarize_live_signal("u1", limit=20)
    finally:
        feature_store.get_recent_events = original

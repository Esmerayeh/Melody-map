from ml.training.pipelines.publish_embeddings import publish_profile_embeddings, publish_track_embeddings
from services.feature_store import list_embeddings


def test_embedding_publish_counts_match_input():
    tracks = {"t1": [0.1, 0.2], "t2": [0.2, 0.3]}
    users = {"u1": [0.3, 0.4]}
    assert publish_track_embeddings(tracks, "v-test") == 2
    assert publish_profile_embeddings(users, "v-test") == 1
    assert len(list_embeddings("track", "v-test", limit=10)) >= 2

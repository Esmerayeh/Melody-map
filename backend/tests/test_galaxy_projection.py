from ml.graph_walk_embeddings import project_node_vectors


def test_galaxy_projection_returns_coordinates():
    projection = project_node_vectors({"a": [1.0, 0.0], "b": [0.0, 1.0]})
    assert "x" in projection["a"]

from ml.serving.auralith_retriever import AuralithRetriever


def test_auralith_retriever_returns_context():
    retriever = AuralithRetriever()
    result = retriever.retrieve("missing-user", "dreamy night", profile={}, limit=4)
    assert "nearest_tracks" in result

from ml.soulmate_engine import SoulmateEngine


def test_soulmate_engine_returns_learned_similarity():
    engine = SoulmateEngine()
    profile = {"representations": {"profileVector": [1.0, 0.0]}}
    result = engine.compute_score(profile, profile)
    assert "learnedCompatibility" in result

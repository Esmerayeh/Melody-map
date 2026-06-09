from unittest.mock import patch

import app as backend_app


# Deterministic LLM-grounded oracle result. Patching this keeps the test
# independent of a live LLM key: the route otherwise (correctly) falls back to
# the retrieval-only path and reports "auralith-retrieval-v1" whenever the
# configured endpoint is unreachable.
_GROUNDED_ORACLE = {
    "text": "A dreamy nocturnal set drifting through low-valence dream pop and ambient texture.",
    "provider": "openai_compatible",
    "llm_model": "llama-3.1-8b-instant",
    "model_version": "auralith-llm-grounded",
    "confidence_level": "high",
    "evidence_used": ["dream pop anchor", "low valence signal"],
    "fallback_reason": None,
}


def test_auralith_agent_turn_returns_model_version():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-auralith"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    with patch("routes.auralith._llm_oracle_response", return_value=_GROUNDED_ORACLE):
        response = client.post("/api/auralith/agent-turn", headers={"X-CSRF-Token": "csrf-token"}, json={"prompt": "dreamy night", "mode": "playlist", "thread_id": "thread-1", "profile": {"user_id": "user-auralith"}})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["modelVersion"] == "auralith-llm-grounded"


def test_auralith_soulmate_answers_from_comparison_context():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-auralith"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    comparison = {
        "overallCompatibility": 86,
        "emotionalCompatibility": 82,
        "discoveryCompatibility": 64,
        "tensionScore": 58,
        "sharedArtists": ["Beach House", "Radiohead"],
        "sharedGenres": ["dream pop", "alternative"],
        "duoIdentity": {"pairName": "The Twin Nocturnes", "oneLine": "Two night-shaped listening selves."},
        "sharedAtmosphereIdentity": {"name": "Silver Rain Cathedral", "explanation": "Shared dream pop and low-valence texture."},
        "songsBothMayLove": [{"title": "Space Song", "artist": "Beach House", "whyItFitsBoth": "mutual favorite"}],
        "evidenceReceipts": ["Shared Spotify artist anchors: Beach House, Radiohead."],
        "confidence": {"score": 0.8, "label": "high"},
    }
    response = client.post(
        "/api/auralith/soulmate",
        headers={"X-CSRF-Token": "csrf-token"},
        json={"prompt": "What songs would we both love?", "comparison": comparison},
    )
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["modelVersion"] == "auralith-soulmate-v1"
    assert "Space Song" in payload["answer"]
    assert payload["fallbackUsed"] is False

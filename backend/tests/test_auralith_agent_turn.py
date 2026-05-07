import app as backend_app


def test_auralith_agent_turn_returns_model_version():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-auralith"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    response = client.post("/api/auralith/agent-turn", headers={"X-CSRF-Token": "csrf-token"}, json={"prompt": "dreamy night", "mode": "playlist", "thread_id": "thread-1", "profile": {"user_id": "user-auralith"}})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["modelVersion"] == "auralith-rag-v1"

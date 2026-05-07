import app as backend_app


def _auth_client():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-rec"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    return client


def test_recommendation_event_route_accepts_payload():
    client = _auth_client()
    response = client.post("/api/recommendations/impression", headers={"X-CSRF-Token": "csrf-token"}, json={"recommendation_id": "rec1", "request_id": "req1", "track_key": "t1", "position": 0, "surface": "discover", "session_id": "s1", "model_version": "ranker-v1", "candidate_source": "ranker"})
    assert response.status_code == 202

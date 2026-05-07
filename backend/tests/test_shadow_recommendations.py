import app as backend_app


def test_recommendation_candidates_route_exists():
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "user-shadow"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    response = client.get("/api/recommendations/candidates")
    assert response.status_code == 200

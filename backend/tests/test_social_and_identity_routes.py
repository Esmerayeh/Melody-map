import app as backend_app
from services.feature_store import register_profile_snapshot, upsert_social_public_profile


def _auth_client(user_id="social-user"):
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": user_id}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    return client


def _profile(name, mbti="INFP", genre="dream pop", energy=0.4, valence=0.3):
    return {
        "profileSchemaVersion": "test",
        "provider": "spotify",
        "timeRange": "medium_term",
        "topArtists": [{"name": name, "genres": [genre]}],
        "topTracks": [{"title": f"{name} Song", "artist": name}],
        "genres": [{"genre": genre}],
        "audioFeatures": {"energy": energy, "valence": valence, "danceability": 0.5},
        "analyticsMetrics": {"mood": "melancholic"},
        "personality": [{"label": "Velvet Romantic"}],
        "mbti": {"type": mbti},
        "representations": {"profileVector": [energy, valence, 0.5]},
        "confidence": {},
        "dataQuality": {},
    }


def test_public_profile_respects_opt_in_privacy():
    register_profile_snapshot(_profile("Private Artist"), user_id="social-private")
    upsert_social_public_profile("social-private", {"display_name": "Private User", "allow_matching": False, "visibility": "private"})
    client = _auth_client("viewer-user")
    response = client.get("/api/social/public-profile/social-private")
    assert response.status_code == 403


def test_social_search_and_compare_work_for_opted_in_users():
    register_profile_snapshot(_profile("You Artist"), user_id="social-me")
    register_profile_snapshot(_profile("Twin Artist"), user_id="social-match")
    upsert_social_public_profile("social-me", {"display_name": "You", "allow_matching": True, "visibility": "public"})
    upsert_social_public_profile("social-match", {"display_name": "Twin", "allow_matching": True, "visibility": "public"})
    client = _auth_client("social-me")
    headers = {"X-CSRF-Token": "csrf-token"}

    search_response = client.post("/api/social/soulmate/search", json={"limit": 5}, headers=headers)
    assert search_response.status_code == 200
    matches = search_response.get_json()["data"]["matches"]
    assert matches
    assert matches[0]["compatibilityScore"] >= 0

    compare_response = client.post("/api/social/soulmate/compare", json={"target_user_id": "social-match"}, headers=headers)
    assert compare_response.status_code == 200
    comparison = compare_response.get_json()["data"]["comparison"]
    assert "sharedArtists" in comparison
    assert "constellation" in comparison


def test_social_public_profiles_expose_stable_slug_and_compare_by_slug():
    register_profile_snapshot(_profile("Slug You"), user_id="social-slug-me")
    register_profile_snapshot(_profile("Slug Twin"), user_id="social-slug-match")
    me = upsert_social_public_profile("social-slug-me", {"display_name": "Slug You", "public_slug": "slug-you-g-me", "allow_matching": True, "visibility": "public"})
    match = upsert_social_public_profile("social-slug-match", {"display_name": "Slug Twin", "public_slug": "slug-twin-match", "allow_matching": True, "visibility": "public"})
    client = _auth_client("social-slug-me")
    headers = {"X-CSRF-Token": "csrf-token"}

    assert me["public_slug"] == "slug-you-g-me"
    profile_response = client.get(f"/api/social/public-profile/{match['public_slug']}")
    assert profile_response.status_code == 200
    assert profile_response.get_json()["data"]["publicSlug"] == "slug-twin-match"

    compare_response = client.post("/api/social/soulmate/compare", json={"target_user_id": match["public_slug"]}, headers=headers)
    assert compare_response.status_code == 200
    assert compare_response.get_json()["data"]["comparison"]["publicSlug"] == "slug-twin-match"


def test_identity_drift_route_returns_timeline():
    register_profile_snapshot(_profile("Drift Artist", mbti="ENFP", genre="indie folk", energy=0.61, valence=0.48), user_id="identity-user")
    client = _auth_client("identity-user")
    response = client.get("/api/identity/drift?range=monthly")
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["selectedRange"] == "monthly"
    assert payload["timeline"]
    assert "drift" in payload

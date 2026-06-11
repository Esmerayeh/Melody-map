from services.listening_identity import (
    attach_mbti_evidence,
    attach_personality_evidence,
    build_identity_layers,
    build_music_code_evidence,
    build_recommendation_reason,
)


def _spotify_profile_parts():
    artists = [
        {"name": "Beach House", "genres": ["dream pop", "shoegaze"], "popularity": 74},
        {"name": "Cocteau Twins", "genres": ["dream pop", "ethereal wave"], "popularity": 67},
        {"name": "Daughter", "genres": ["indie folk", "slowcore"], "popularity": 58},
    ]
    tracks = [
        {"id": "t1", "title": "Space Song", "artist": "Beach House", "release_date": "2015-08-28"},
        {"id": "t2", "title": "Fade Into You", "artist": "Mazzy Star", "release_date": "1993-09-27"},
    ]
    recent = [
        {"id": "t1", "title": "Space Song", "artist": "Beach House", "played_at": "2026-05-07T22:30:00Z"},
        {"id": "t3", "title": "Youth", "artist": "Daughter", "played_at": "2026-05-08T01:12:00Z"},
    ]
    saved = [
        {"id": "t2", "title": "Fade Into You", "artist": "Mazzy Star", "release_date": "1993-09-27"},
    ]
    audio_rows = [
        {"id": "t1", "energy": 0.32, "valence": 0.28, "danceability": 0.41, "acousticness": 0.58, "instrumentalness": 0.08, "speechiness": 0.04, "tempo": 98},
        {"id": "t2", "energy": 0.27, "valence": 0.29, "danceability": 0.39, "acousticness": 0.61, "instrumentalness": 0.02, "speechiness": 0.03, "tempo": 84},
    ]
    audio = {
        "energy": 0.295,
        "valence": 0.285,
        "danceability": 0.4,
        "acousticness": 0.595,
        "instrumentalness": 0.05,
        "speechiness": 0.035,
        "tempo": 91,
    }
    genres = [{"genre": "dream pop", "count": 4.0}, {"genre": "shoegaze", "count": 3.2}, {"genre": "indie folk", "count": 1.7}]
    analytics = {"mood": "melancholic", "nostalgiaIndex": 44, "diversityScore": 72, "sampleSizes": {"nostalgiaIndex": 2}}
    return artists, tracks, recent, saved, audio, audio_rows, genres, analytics


def test_identity_layers_are_grounded_in_spotify_receipts():
    artists, tracks, recent, saved, audio, rows, genres, analytics = _spotify_profile_parts()
    layers = build_identity_layers(
        top_artists=artists,
        top_tracks=tracks,
        recently_played=recent,
        saved_tracks=saved,
        audio_features=audio,
        audio_features_list=rows,
        genres=genres,
        analytics=analytics,
        data_quality={"audioCoverage": 1.0},
    )

    assert layers["livingIdentity"]["title"]
    assert layers["spotifyEvidence"]["artistAnchors"][:2] == ["Beach House", "Cocteau Twins"]
    assert any("Beach House" in receipt for receipt in layers["livingIdentity"]["receipts"])
    assert any(signal["id"] == "nighttime_emotionality" and signal["available"] for signal in layers["signals"])
    assert layers["identityDNA"]


def test_identity_layers_do_not_invent_when_spotify_signal_is_missing():
    layers = build_identity_layers()

    assert layers["livingIdentity"]["needsMoreHistory"] is True
    assert "needs more Spotify listening history" in layers["musicIdentitySummary"]
    assert layers["identityDNA"] == []


def test_personality_and_mbti_evidence_attach_receipts():
    artists, tracks, recent, saved, audio, rows, genres, analytics = _spotify_profile_parts()
    layers = build_identity_layers(
        top_artists=artists,
        top_tracks=tracks,
        recently_played=recent,
        saved_tracks=saved,
        audio_features=audio,
        audio_features_list=rows,
        genres=genres,
        analytics=analytics,
    )
    traits = attach_personality_evidence([{"id": "dreamy", "label": "Dreamy", "pct": 42}], layers)
    assert traits[0]["grounded"] is True
    assert traits[0]["evidence"]

    mbti = {"type": "INFP", "name": "Test", "desc": "Static", "axes": {"IE": {"label": "Introvert", "score": 72}}}
    evidence = build_music_code_evidence(mbti, audio, genres, artists)
    enriched = attach_mbti_evidence(mbti, evidence)
    assert enriched["desc"].startswith("A four-letter shorthand derived from Spotify")
    assert enriched["axes"]["IE"]["evidence"]


def test_recommendation_reason_uses_audio_or_profile_anchors():
    profile = {
        "audioFeatures": {"energy": 0.3, "valence": 0.28},
        "recommendationContext": {
            "anchors": ["Beach House"],
            "genres": ["dream pop"],
            "signals": [{"label": "Atmosphere preference", "pct": 81, "evidence": ["Average acousticness is 60% across 2 Spotify audio-featured top tracks"]}],
        },
    }
    reason = build_recommendation_reason(profile, {"audio_features": {"energy": 0.34, "valence": 0.3}})

    assert reason["grounded"] is True
    assert "Average acousticness" in reason["text"]
    assert any("energy" in item for item in reason["evidence"])


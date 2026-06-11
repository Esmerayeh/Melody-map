from ml.discover_engine import discover_engine


def test_discover_reasons_accept_spotify_genre_objects():
    playlists = discover_engine.generate_playlists(
        genres=[{"genre": "dream pop"}, {"genre": "shoegaze"}],
        energy=0.32,
        valence=0.28,
        n_playlists=2,
        seed=1,
    )

    assert playlists
    assert playlists[0]["why_receipts"]
    assert "Spotify" in playlists[0]["why_it_fits"]


def test_discover_marks_preview_when_profile_is_not_grounded():
    playlists = discover_engine.generate_playlists(
        genres=[],
        energy=0.5,
        valence=0.5,
        n_playlists=1,
        grounded=False,
    )

    assert playlists[0]["why_methodology"] == "ungrounded_preview_seed"
    assert "preview seed" in playlists[0]["why_it_fits"]


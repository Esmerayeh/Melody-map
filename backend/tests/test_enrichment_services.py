"""Tests for the server-side enrichment layer that recovers genres (Last.fm
tags) and audio features (provider-agnostic service) after Spotify removed
both. The hard requirement throughout: enrichment failures must NEVER break,
hang, or 500 a profile build."""

from types import SimpleNamespace

import pytest

import services.audio_features_service as afs
import services.genre_tag_enrichment as gte
import services.music_profile_builder as builder


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.ok = status < 400
        self.text = str(payload)[:300]

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'status {self.status_code}')


@pytest.fixture(autouse=True)
def _reset_caches():
    # Detach Mongo so these unit tests never see cache state written by other
    # tests (the app fixture inits both services against a shared mongomock).
    saved_gte_mongo, saved_afs_mongo = gte._mongo, afs._mongo
    gte._mongo = None
    afs._mongo = None
    gte._memory_cache.clear()
    yield
    gte._memory_cache.clear()
    gte._mongo, afs._mongo = saved_gte_mongo, saved_afs_mongo


# ── Last.fm genre tags ───────────────────────────────────────────────────────

def test_tag_filter_drops_junk_and_low_weight():
    raw = [
        {'name': 'shoegaze', 'count': 100},
        {'name': 'seen live', 'count': 90},
        {'name': 'dream pop', 'count': 60},
        {'name': 'obscure whisper', 'count': 3},
        {'name': 'Favorites', 'count': 50},
    ]
    assert gte._filter_tags(raw) == ['shoegaze', 'dream pop']


def test_lastfm_enrichment_fills_genres_from_live_fetch(monkeypatch):
    monkeypatch.setattr(gte, 'Config', SimpleNamespace(lastfm_api_key='k'))
    monkeypatch.setattr(gte, 'fetch_lastfm_tags', lambda name: ['shoegaze', 'dream pop'])

    artists = [{'name': 'Slowdive', 'genres': []}, {'name': 'Ride', 'genres': ['already set']}]
    enriched, diag = gte.enrich_artist_genres_via_lastfm(artists)

    assert enriched[0]['genres'] == ['shoegaze', 'dream pop']
    assert enriched[0]['_genre_source'] == 'lastfm'
    assert enriched[1]['genres'] == ['already set']
    assert diag['eligible'] == 1
    assert diag['fetched'] == 1


def test_lastfm_enrichment_prefers_cache_and_skips_http(monkeypatch):
    monkeypatch.setattr(gte, 'Config', SimpleNamespace(lastfm_api_key='k'))
    gte._memory_cache['slowdive'] = ['shoegaze']

    def _boom(name):
        raise AssertionError('HTTP must not be called on a cache hit')

    monkeypatch.setattr(gte, 'fetch_lastfm_tags', _boom)
    enriched, diag = gte.enrich_artist_genres_via_lastfm([{'name': 'Slowdive', 'genres': []}])

    assert enriched[0]['genres'] == ['shoegaze']
    assert diag['cacheHits'] == 1
    assert diag['fetched'] == 0


def test_lastfm_enrichment_survives_total_failure(monkeypatch):
    monkeypatch.setattr(gte, 'Config', SimpleNamespace(lastfm_api_key='k'))
    monkeypatch.setattr(gte, 'fetch_lastfm_tags', lambda name: None)

    artists = [{'name': f'Artist {i}', 'genres': []} for i in range(6)]
    enriched, diag = gte.enrich_artist_genres_via_lastfm(artists)

    assert all(artist['genres'] == [] for artist in enriched)
    assert diag['failed'] >= gte._MAX_CONSECUTIVE_FAILURES
    assert diag['gaveUp'] is True


def test_lastfm_enrichment_noop_without_api_key(monkeypatch):
    monkeypatch.setattr(gte, 'Config', SimpleNamespace(lastfm_api_key=None))
    artists = [{'name': 'Slowdive', 'genres': []}]
    enriched, diag = gte.enrich_artist_genres_via_lastfm(artists)

    assert enriched[0]['genres'] == []
    assert diag['source'] == 'unconfigured'


# ── Audio features service ───────────────────────────────────────────────────

RECCOBEATS_PAYLOAD = {
    'content': [
        {
            'id': '91142821-1b57-4d87-845e-fc3482635bc5',
            'href': 'https://open.spotify.com/track/track_a',
            'acousticness': 0.0012, 'danceability': 0.352, 'energy': 0.911,
            'instrumentalness': 0.0, 'loudness': -5.23, 'speechiness': 0.0747,
            'tempo': 148.033, 'valence': 0.236,
        },
        {
            'id': '26a0005e-b4f3-4096-8468-3b2854bd2dd9',
            'href': 'https://open.spotify.com/track/track_b',
            'acousticness': 1.4, 'danceability': -0.2, 'energy': 0.43,
            'instrumentalness': 0.0001, 'loudness': -99.0, 'speechiness': 0.037,
            'tempo': 9000.0, 'valence': 0.104,
        },
    ],
}


def test_reccobeats_provider_maps_spotify_ids_from_href(monkeypatch):
    monkeypatch.setattr(afs.requests, 'get', lambda *a, **k: FakeResponse(RECCOBEATS_PAYLOAD))
    result = afs.ReccoBeatsProvider().fetch(['track_a', 'track_b'])

    assert set(result) == {'track_a', 'track_b'}
    assert result['track_a']['energy'] == 0.911


def test_get_audio_features_clamps_out_of_range_values(monkeypatch):
    monkeypatch.setattr(afs, 'Config', SimpleNamespace(audio_features_provider='reccobeats'))
    monkeypatch.setattr(afs.requests, 'get', lambda *a, **k: FakeResponse(RECCOBEATS_PAYLOAD))

    rows, diag = afs.get_audio_features_for_tracks([
        {'id': 'track_a', 'title': 'A', 'artist': 'X'},
        {'id': 'track_b', 'title': 'B', 'artist': 'Y'},
    ])

    assert diag['fetched'] == 2
    by_id = {row['id']: row for row in rows}
    assert by_id['track_b']['acousticness'] == 1.0   # clamped from 1.4
    assert by_id['track_b']['danceability'] == 0.0   # clamped from -0.2
    assert by_id['track_b']['loudness'] == -60.0     # clamped from -99
    assert by_id['track_b']['tempo'] == 300.0        # clamped from 9000


def test_get_audio_features_survives_provider_failure(monkeypatch):
    monkeypatch.setattr(afs, 'Config', SimpleNamespace(audio_features_provider='reccobeats'))

    def _down(*a, **k):
        raise RuntimeError('provider down')

    monkeypatch.setattr(afs.requests, 'get', _down)
    rows, diag = afs.get_audio_features_for_tracks([{'id': 'track_a'}])

    assert rows == []
    assert diag['gaveUp'] is True
    assert diag['uncovered'] == 1


def test_get_audio_features_unknown_provider_is_safe(monkeypatch):
    monkeypatch.setattr(afs, 'Config', SimpleNamespace(audio_features_provider='nonexistent'))
    rows, diag = afs.get_audio_features_for_tracks([{'id': 'track_a'}])

    assert rows == []
    assert diag['provider'] == 'unconfigured'


# ── Builder integration: enrichment failures must never break the build ─────

def _spotify_router(url, headers=None, params=None, timeout=None):
    if url.endswith('/me'):
        return FakeResponse({'id': 'user1', 'display_name': 'Tester', 'images': []})
    if '/me/top/artists' in url:
        return FakeResponse({'items': [
            {'id': 'art1', 'name': 'Slowdive', 'genres': [], 'popularity': 70, 'images': []},
            {'id': 'art2', 'name': 'Beach House', 'genres': [], 'popularity': 78, 'images': []},
        ]})
    if '/me/top/tracks' in url:
        return FakeResponse({'items': [
            {'id': 'track_a', 'name': 'Song A', 'artists': [{'name': 'Slowdive'}],
             'album': {'images': [], 'release_date': '2017-05-05'}, 'popularity': 60, 'external_urls': {}},
            {'id': 'track_b', 'name': 'Song B', 'artists': [{'name': 'Beach House'}],
             'album': {'images': [], 'release_date': '2012-05-15'}, 'popularity': 72, 'external_urls': {}},
        ]})
    if '/audio-features' in url:
        return FakeResponse({'error': {'status': 403}}, status=403)
    if '/artists/' in url:
        return FakeResponse({}, status=404)
    return FakeResponse({'items': []})


@pytest.fixture
def _spotify_mock(monkeypatch):
    monkeypatch.setattr(builder.req, 'get', _spotify_router)
    monkeypatch.setattr(builder, '_get_spotify_service', lambda: None)


def test_build_survives_both_enrichment_sources_raising(monkeypatch, _spotify_mock):
    def _explode(*a, **k):
        raise RuntimeError('enrichment source down')

    monkeypatch.setattr(gte, 'enrich_artist_genres_via_lastfm', _explode)
    monkeypatch.setattr(afs, 'get_audio_features_for_tracks', _explode)

    profile = builder.build_music_profile('tok', 'medium_term', 50)

    assert len(profile['topArtists']) == 2
    assert profile['genres'] == []
    assert profile['analyticsMetrics']['mood'] is None
    assert 'spotify_audio_features_unavailable' in profile['dataQuality']['degradedReasons']


def test_build_revives_genres_and_audio_through_enrichment(monkeypatch, _spotify_mock):
    def _fake_lastfm(artists):
        return (
            [{**artist, 'genres': ['dream pop', 'shoegaze']} for artist in artists],
            {'source': 'lastfm_tags', 'resolved': len(artists)},
        )

    def _fake_audio(tracks):
        rows = [
            {'id': track['id'], 'energy': 0.42, 'valence': 0.31, 'danceability': 0.5,
             'acousticness': 0.6, 'instrumentalness': 0.2, 'speechiness': 0.04,
             'tempo': 110.0, 'loudness': -9.5}
            for track in tracks
        ]
        return rows, {'provider': 'reccobeats', 'source': 'reccobeats', 'fetched': len(rows)}

    monkeypatch.setattr(gte, 'enrich_artist_genres_via_lastfm', _fake_lastfm)
    monkeypatch.setattr(afs, 'get_audio_features_for_tracks', _fake_audio)

    profile = builder.build_music_profile('tok', 'medium_term', 50)

    # Genres revived → aesthetic tags, diversity, galaxy genre nodes follow.
    assert [g['genre'] for g in profile['genres']][:2] == ['dream pop', 'shoegaze']
    assert profile['aestheticTags']
    assert profile['analyticsMetrics']['diversityScore'] is not None
    assert any(node.get('type') == 'genre' for node in profile['galaxyNodes'])

    # Audio features revived → analytics, mood, personality, MBTI follow.
    assert profile['audioFeatures']['energy'] == 0.42
    assert profile['analyticsMetrics']['mood'] is not None
    assert profile['dataQuality']['audioCoverage'] == 1.0
    assert profile['personality']
    assert profile['mbti'] is not None
    assert 'spotify_audio_features_unavailable' not in profile['dataQuality']['degradedReasons']

from services.feature_store import get_live_signal_cached, get_recent_events
from services.realtime_listening_sync import sync_spotify_listening


class FakeResult:
    def __init__(self, ok, data=None):
        self.ok = ok
        self.data = data or {}
        self.status = 200
        self.error_message = None
        self.error_code = None


def test_realtime_sync_dedupes_and_updates_live_signal(monkeypatch):
    current_payload = {
        "item": {
            "id": "track-1",
            "name": "Space Song",
            "artists": [{"name": "Beach House"}],
            "album": {"name": "Depression Cherry", "images": [{"url": "https://example.com/cover.jpg"}]},
            "external_urls": {"spotify": "https://open.spotify.com/track/track-1"},
            "preview_url": "https://example.com/preview.mp3",
        },
        "timestamp": "2026-05-07T12:00:00+00:00",
    }
    recent_payload = {
        "items": [
            {
                "track": current_payload["item"],
                "played_at": "2026-05-07T12:00:00+00:00",
            }
        ]
    }

    def fake_get(_token, path, params=None):
        if path == "/me/player/currently-playing":
            return FakeResult(True, current_payload)
        return FakeResult(True, recent_payload)

    monkeypatch.setattr("services.realtime_listening_sync.spotify_proxy_service.get", fake_get)
    result_one = sync_spotify_listening("live-sync-user", "spotify-token")
    result_two = sync_spotify_listening("live-sync-user", "spotify-token")

    assert result_one["inserted"] >= 1
    assert result_two["deduped"] >= 1
    assert get_recent_events("live-sync-user", limit=5)
    assert get_live_signal_cached("live-sync-user") is not None

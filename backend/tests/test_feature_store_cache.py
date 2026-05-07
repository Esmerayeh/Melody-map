from services.feature_store import get_live_signal_cached, upsert_online_features_cached


def test_feature_store_cache_round_trip():
    payload = {"eventCount": 3, "sessionIntensity": 0.4}
    upsert_online_features_cached("user-cache", payload)
    cached = get_live_signal_cached("user-cache")
    assert cached["eventCount"] == 3


def test_feature_store_cache_handles_missing_user():
    assert get_live_signal_cached("missing-user") in (None, {})

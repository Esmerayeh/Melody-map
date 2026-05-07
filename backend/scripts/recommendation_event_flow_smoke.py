from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

import app as backend_app
from services.feature_store import get_live_signal_cached
from services.stream_consumers.session_feature_consumer import process_event


def main() -> int:
    flask_app = backend_app.create_app()
    client = flask_app.test_client()
    token = backend_app.jwt.encode({"user_id": "smoke-user"}, flask_app.config["SECRET_KEY"], algorithm="HS256")
    client.set_cookie("mm_app_session", token)
    client.set_cookie("mm_csrf", "csrf-token")
    response = client.post(
        "/api/events/listening",
        headers={"X-CSRF-Token": "csrf-token"},
        json={"type": "play", "track_id": "track-smoke", "title": "Smoke Song", "artist": "Verifier", "session_id": "sess-smoke", "context": {"surface": "discover"}},
    )
    payload = response.get_json()
    event = payload["data"]["event"]
    process_event(event)
    signal = get_live_signal_cached("smoke-user")
    passed = response.status_code == 202 and bool(signal)
    print(
        json.dumps(
            {
                "status": "PASS" if passed else "FAIL",
                "status_code": response.status_code,
                "event_id": event["event_id"],
                "live_signal": signal,
            },
            indent=2,
            default=str,
        )
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

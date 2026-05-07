from __future__ import annotations

import argparse
import time

from services.realtime_listening_sync import sync_spotify_listening


def main() -> int:
    parser = argparse.ArgumentParser(description="Near-real-time Spotify polling worker for Melody Map.")
    parser.add_argument("--user-id", required=True, help="Authenticated Melody Map user id.")
    parser.add_argument("--spotify-token", required=True, help="Spotify access token for the user.")
    parser.add_argument("--interval-seconds", type=int, default=30, help="Polling interval in seconds.")
    parser.add_argument("--once", action="store_true", help="Run a single sync cycle and exit.")
    args = parser.parse_args()

    while True:
        result = sync_spotify_listening(args.user_id, args.spotify_token)
        print(
            {
                "user_id": args.user_id,
                "inserted": result.get("inserted"),
                "deduped": result.get("deduped"),
                "current_track": result.get("current_track"),
            }
        )
        if args.once:
            return 0
        time.sleep(max(args.interval_seconds, 10))


if __name__ == "__main__":
    raise SystemExit(main())

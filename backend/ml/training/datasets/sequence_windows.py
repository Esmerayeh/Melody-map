from __future__ import annotations

from collections import defaultdict

import pandas as pd


POSITIVE_EVENT_TYPES = {
    "play",
    "save",
    "listening",
    "recommendation_click",
    "recommendation_save",
    "recommendation_replay",
    "open_auralith_result",
}


def _normalize_frame(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy()
    normalized["user_id"] = normalized["user_id"].astype(str)
    normalized["track_key"] = normalized["track_key"].astype(str)
    normalized["event_type"] = normalized["event_type"].fillna("play").astype(str)
    normalized["session_id"] = normalized["session_id"].fillna("missing-session").astype(str)
    normalized["timestamp"] = pd.to_datetime(normalized["timestamp"], utc=True, errors="coerce")
    normalized = normalized.dropna(subset=["timestamp"])
    return normalized.sort_values(["user_id", "session_id", "timestamp"])


def build_session_windows(frame: pd.DataFrame, window_size: int = 5) -> list[dict]:
    if frame.empty:
        return []
    normalized = _normalize_frame(frame)
    rows: list[dict] = []
    for (_, session_id), session in normalized.groupby(["user_id", "session_id"], sort=False):
        positive = session[session["event_type"].isin(POSITIVE_EVENT_TYPES)]
        track_keys = positive["track_key"].tolist()
        if len(track_keys) < 2:
            continue
        user_id = positive["user_id"].iloc[0]
        for index in range(1, len(track_keys)):
            history = track_keys[max(0, index - window_size) : index]
            target = track_keys[index]
            if not history:
                continue
            rows.append(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "history_tracks": history,
                    "target_track": target,
                }
            )
    return rows


def build_user_histories(frame: pd.DataFrame, max_history: int = 50) -> dict[str, list[str]]:
    if frame.empty:
        return {}
    normalized = _normalize_frame(frame)
    histories: dict[str, list[str]] = defaultdict(list)
    for row in normalized.itertuples():
        if row.event_type not in POSITIVE_EVENT_TYPES:
            continue
        histories[str(row.user_id)].append(str(row.track_key))
    return {user_id: track_keys[-max_history:] for user_id, track_keys in histories.items() if track_keys}

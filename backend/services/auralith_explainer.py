def build_explainability_payload(answer_payload: dict, retrieval_context: dict, model_version: str) -> dict:
    return {
        **answer_payload,
        "modelVersion": model_version,
        "confidence": {
            "score": round(float(retrieval_context.get("confidence", 0.5)), 3),
            "label": "medium-high" if float(retrieval_context.get("confidence", 0.5)) >= 0.75 else "medium",
        },
        "retrieval_trace": {
            "snapshotId": (retrieval_context.get("snapshot") or {}).get("snapshot_id"),
            "memoriesUsed": len(retrieval_context.get("memories", [])),
            "nearestTracks": retrieval_context.get("nearest_tracks", [])[:6],
            "recentEventsUsed": retrieval_context.get("recent_events", [])[:6],
        },
    }

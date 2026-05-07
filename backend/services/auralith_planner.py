def plan_auralith_steps(mode: str, prompt: str, retrieval_context: dict) -> list[dict]:
    return [
        {"id": "retrieve_memory", "label": "Retrieve memory", "status": "completed", "memories": len(retrieval_context.get("memories", []))},
        {"id": "retrieve_music", "label": "Retrieve music neighbors", "status": "completed", "tracks": len(retrieval_context.get("nearest_tracks", []))},
        {"id": "reason", "label": f"Reason over {mode}", "status": "completed", "promptLength": len(prompt or "")},
    ]

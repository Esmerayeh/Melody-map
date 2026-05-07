from celery import Celery


celery_app = Celery(
    "melody_map_worker",
    broker="redis://redis:6379/1",
    backend="redis://redis:6379/2",
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_track_started=True,
)


@celery_app.task(name="profile.recompute")
def recompute_profile(user_id: str, source_window: str = "medium_term") -> dict:
    return {
        "job": "profile.recompute",
        "user_id": user_id,
        "source_window": source_window,
        "status": "queued-for-real-implementation",
    }


@celery_app.task(name="ml.similarity.refresh")
def refresh_similarity(subject_id: str) -> dict:
    return {
        "job": "ml.similarity.refresh",
        "subject_id": subject_id,
        "status": "queued-for-real-implementation",
    }


@celery_app.task(name="galaxy.layout.generate")
def generate_galaxy_layout(profile: dict) -> dict:
    artists = profile.get("topArtists") or []
    tracks = profile.get("topTracks") or []
    return {
        "job": "galaxy.layout.generate",
        "artifact_id": f"galaxy-{profile.get('user_id', 'session-user')}",
        "node_count": len(artists) + min(len(tracks), 20),
        "edge_count": max(0, len(artists) - 1) + min(len(tracks), 20),
        "status": "completed",
    }

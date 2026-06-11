from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor


class JobRegistry:
    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="melodymap")
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def submit(self, name: str, fn, *args, dedupe_key: str | None = None, **kwargs) -> dict:
        with self._lock:
            if dedupe_key:
                for job in self._jobs.values():
                    if job.get("dedupe_key") == dedupe_key and job.get("status") in {"queued", "running"}:
                        return job

            job_id = uuid.uuid4().hex
            job = {
                "id": job_id,
                "name": name,
                "status": "queued",
                "created_at": time.time(),
                "started_at": None,
                "finished_at": None,
                "error": None,
                "result": None,
                "dedupe_key": dedupe_key,
            }
            self._jobs[job_id] = job

        future = self._executor.submit(self._run, job_id, fn, *args, **kwargs)
        job["future"] = future
        return job

    def _run(self, job_id: str, fn, *args, **kwargs):
        with self._lock:
            job = self._jobs[job_id]
            job["status"] = "running"
            job["started_at"] = time.time()
        try:
            result = fn(*args, **kwargs)
            with self._lock:
                job["status"] = "completed"
                job["result"] = result
                job["finished_at"] = time.time()
            return result
        except Exception as exc:  # pragma: no cover - status path is tested indirectly
            with self._lock:
                job["status"] = "failed"
                job["error"] = str(exc)
                job["finished_at"] = time.time()
            # Surface background failures instead of swallowing them — a silent
            # job crash looks identical to "still building" from the outside.
            try:
                from utils.logger import logger
                logger.error({"event": "job_failed", "job": job.get("name"), "error": str(exc)}, exc_info=True)
            except Exception:
                pass
            raise

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            return {key: value for key, value in job.items() if key != "future"}


job_registry = JobRegistry()

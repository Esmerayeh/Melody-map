from __future__ import annotations

from utils.logger import logger


def process_dlq_event(payload: dict) -> dict:
    logger.warning({"event": "recommendation_dlq_event", "payload": payload})
    return payload

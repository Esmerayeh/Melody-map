from __future__ import annotations

import json
from typing import Any

from config import Config
from utils.logger import logger

_producer = None


def get_kafka_producer():
    global _producer
    if _producer is not None:
        return _producer
    if not Config.kafka_bootstrap_servers:
        return None
    try:
        from kafka import KafkaProducer  # type: ignore

        _producer = KafkaProducer(
            bootstrap_servers=[server.strip() for server in Config.kafka_bootstrap_servers.split(",") if server.strip()],
            value_serializer=lambda payload: json.dumps(payload, default=str).encode("utf-8"),
            key_serializer=lambda payload: payload.encode("utf-8") if payload else None,
            retries=3,
            linger_ms=10,
        )
        return _producer
    except Exception as exc:
        logger.warning({"event": "kafka_producer_unavailable", "error": str(exc)})
        return None


def publish_event(payload: dict[str, Any], topic: str | None = None, key: str | None = None) -> bool:
    producer = get_kafka_producer()
    if producer is None:
        return False
    try:
        producer.send(topic or Config.kafka_events_topic, key=key or payload.get("event_id"), value=payload)
        return True
    except Exception as exc:
        logger.warning({"event": "kafka_publish_failed", "topic": topic or Config.kafka_events_topic, "error": str(exc)})
        return False


def publish_event_strict(
    payload: dict[str, Any],
    topic: str | None = None,
    key: str | None = None,
    timeout_seconds: float = 5.0,
) -> tuple[bool, str]:
    producer = get_kafka_producer()
    if producer is None:
        return False, "Kafka producer unavailable"
    selected_topic = topic or Config.kafka_events_topic
    try:
        future = producer.send(selected_topic, key=key or payload.get("event_id"), value=payload)
        record = future.get(timeout=timeout_seconds)
        producer.flush(timeout=timeout_seconds)
        partition = getattr(record, "partition", "unknown")
        offset = getattr(record, "offset", "unknown")
        return True, f"acked topic={selected_topic} partition={partition} offset={offset}"
    except Exception as exc:
        logger.warning({"event": "kafka_publish_strict_failed", "topic": selected_topic, "error": str(exc)})
        return False, str(exc)

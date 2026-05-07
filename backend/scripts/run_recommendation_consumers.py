from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import Config
from services.stream_consumers.dlq_consumer import process_dlq_event
from services.stream_consumers.recommendation_feedback_consumer import process_feedback_event
from services.stream_consumers.session_feature_consumer import process_event as process_session_event


def main() -> int:
    if not Config.kafka_bootstrap_servers:
        print("KAFKA_BOOTSTRAP_SERVERS is not configured.")
        return 1

    from kafka import KafkaConsumer  # type: ignore

    consumer = KafkaConsumer(
        Config.kafka_events_topic,
        Config.kafka_recommendation_feedback_topic,
        Config.kafka_dlq_topic,
        bootstrap_servers=[server.strip() for server in Config.kafka_bootstrap_servers.split(",") if server.strip()],
        value_deserializer=lambda payload: json.loads(payload.decode("utf-8")),
        auto_offset_reset="latest",
        enable_auto_commit=True,
        group_id="melody-map-recommendation-consumers",
    )
    print(f"Listening on topics: {Config.kafka_events_topic}, {Config.kafka_recommendation_feedback_topic}, {Config.kafka_dlq_topic}")
    for message in consumer:
        if message.topic == Config.kafka_events_topic:
            process_session_event(message.value)
        elif message.topic == Config.kafka_recommendation_feedback_topic:
            process_feedback_event(message.value)
        else:
            process_dlq_event(message.value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

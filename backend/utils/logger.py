"""Structured JSON logger for the Flask app."""
import logging
import json
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            'ts':      datetime.now(timezone.utc).isoformat(),
            'level':   record.levelname,
            'logger':  record.name,
            'msg':     record.getMessage(),
        }
        if record.exc_info:
            log['exc'] = self.formatException(record.exc_info)
        return json.dumps(log)


def get_logger(name: str = 'melody_map') -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


logger = get_logger()

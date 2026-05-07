from __future__ import annotations

import threading
import time
from dataclasses import dataclass


@dataclass
class CircuitState:
    failures: int = 0
    opened_until: float = 0.0


class CircuitBreakerOpen(Exception):
    pass


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_seconds: int = 45) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self._states: dict[str, CircuitState] = {}
        self._lock = threading.Lock()

    def _state(self, key: str) -> CircuitState:
        with self._lock:
            return self._states.setdefault(key, CircuitState())

    def allow(self, key: str) -> bool:
        state = self._state(key)
        return state.opened_until <= time.time()

    def guard(self, key: str) -> None:
        if not self.allow(key):
            raise CircuitBreakerOpen(key)

    def record_success(self, key: str) -> None:
        with self._lock:
            self._states[key] = CircuitState()

    def record_failure(self, key: str) -> None:
        with self._lock:
            state = self._states.setdefault(key, CircuitState())
            state.failures += 1
            if state.failures >= self.failure_threshold:
                state.opened_until = time.time() + self.recovery_seconds

    def snapshot(self, key: str) -> dict:
        state = self._state(key)
        return {
            "failures": state.failures,
            "open": state.opened_until > time.time(),
            "opened_until": state.opened_until or None,
        }

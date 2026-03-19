"""Simple in-memory rate limiter using a sliding window."""
import time
from collections import defaultdict, deque
from functools import wraps
from flask import request, jsonify


_windows: dict = defaultdict(deque)


def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    Decorator factory.  Limits each IP to `max_requests` per `window_seconds`.
    Usage:
        @rate_limit(max_requests=10, window_seconds=60)
        def my_route(): ...
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip  = request.remote_addr or 'unknown'
            key = f"{f.__name__}:{ip}"
            now = time.time()
            dq  = _windows[key]

            # Evict timestamps outside the window
            while dq and dq[0] < now - window_seconds:
                dq.popleft()

            if len(dq) >= max_requests:
                retry_after = int(window_seconds - (now - dq[0]))
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after,
                }), 429

            dq.append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

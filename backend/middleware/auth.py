"""JWT authentication middleware."""
import jwt
from functools import wraps
from flask import request, g, current_app

from utils.api import api_error


def require_auth(f):
    """Decorator that validates JWT and sets g.user_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return api_error('Authorization header required', 401, code='AUTH_HEADER_REQUIRED')
        token = auth[7:]
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            g.user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return api_error('Token expired', 401, code='TOKEN_EXPIRED')
        except jwt.InvalidTokenError:
            return api_error('Invalid token', 401, code='INVALID_TOKEN')
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Decorator that sets g.user_id if token present, but doesn't require it."""
    @wraps(f)
    def decorated(*args, **kwargs):
        g.user_id = None
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            try:
                payload = jwt.decode(auth[7:], current_app.config['SECRET_KEY'], algorithms=['HS256'])
                g.user_id = payload['user_id']
            except jwt.InvalidTokenError:
                pass
        return f(*args, **kwargs)
    return decorated

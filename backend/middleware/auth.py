"""JWT authentication middleware."""
from functools import wraps

import jwt
from flask import current_app, g, request

from utils.api import api_error
from utils.auth_cookies import auth_token_from_request


def require_auth(f):
    """Decorator that validates JWT and sets g.user_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = auth_token_from_request(request)
        if not token:
            return api_error('Authenticated session required', 401, code='AUTH_REQUIRED')
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
        token = auth_token_from_request(request)
        if token:
            try:
                payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                g.user_id = payload['user_id']
            except jwt.InvalidTokenError:
                pass
        return f(*args, **kwargs)
    return decorated

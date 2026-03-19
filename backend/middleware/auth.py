"""JWT authentication middleware."""
import jwt
from functools import wraps
from flask import request, jsonify, g
from config import Config


def require_auth(f):
    """Decorator that validates JWT and sets g.user_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Authorization header required'}), 401
        token = auth[7:]
        try:
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            g.user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
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
                payload = jwt.decode(auth[7:], Config.SECRET_KEY, algorithms=['HS256'])
                g.user_id = payload['user_id']
            except jwt.InvalidTokenError:
                pass
        return f(*args, **kwargs)
    return decorated

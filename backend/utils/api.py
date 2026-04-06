"""Shared response helpers for predictable backend payloads."""

from __future__ import annotations

from flask import jsonify


def api_success(data=None, status: int = 200, **meta):
    payload = {"success": True, "data": data}
    payload.update({key: value for key, value in meta.items() if value is not None})
    return jsonify(payload), status


def legacy_envelope(data, **meta) -> dict:
    payload = data_envelope(data, **meta)
    if isinstance(data, dict):
        for key, value in data.items():
            payload.setdefault(key, value)
    return payload


def api_success_legacy(data=None, status: int = 200, **meta):
    payload = legacy_envelope(data, **meta)
    return jsonify(payload), status


def api_error(
    message: str,
    status: int = 400,
    *,
    code: str | None = None,
    details=None,
    warnings=None,
    limited_signal: bool | None = None,
):
    payload = {
        "success": False,
        "error": {
            "message": message,
            "code": code or "REQUEST_FAILED",
        },
    }
    if details is not None:
        payload["error"]["details"] = details
    if warnings is not None:
        payload["warnings"] = warnings
    if limited_signal is not None:
        payload["limitedSignal"] = limited_signal
    return jsonify(payload), status


def data_envelope(data, **meta) -> dict:
    payload = {"success": True, "data": data}
    payload.update({key: value for key, value in meta.items() if value is not None})
    return payload

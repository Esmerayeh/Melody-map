"""
Smoke test for the Auralith _call_llm helper with a Groq-shaped mock response.

Tests:
  1. OpenAI-compatible (Groq) success path — choices[0].message.content
  2. Anthropic success path — content[0].text
  3. 401 auth error → fallback_reason = "auth_error"
  4. 429 rate limit → fallback_reason = "rate_limited"
  5. Timeout → fallback_reason = "llm_timeout"
  6. Empty choices content → fallback_reason = "llm_empty_response"
  7. No endpoint configured → provider = "none", fallback_reason = "llm_not_configured"
  8. API key is NEVER included in any log output

Run with:  pytest backend/tests/test_auralith_groq_smoke.py -v
"""
from __future__ import annotations

import json
import unittest
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

# Import the function under test directly. Its real dependencies (config, ml,
# services, numpy) are all importable, so we do NOT install global sys.modules
# stubs — doing so previously leaked into sibling tests (turning `ml` into a
# non-package) and, because the stubs used setdefault, silently let the real
# Config through in a full-suite run, firing real network calls. Instead each
# test swaps only the engine's module-level `Config` reference (see setUp).
from services.auralith_engine import _call_llm  # noqa: E402


# Config double — provides only the fields _call_llm touches. Patched onto
# services.auralith_engine.Config per test so nothing global is mutated.
_config_stub = MagicMock()
_config_stub.auralith_llm_provider    = "openai_compatible"   # overridden per test
_config_stub.auralith_llm_endpoint    = "https://api.groq.com/openai/v1/chat/completions"
_config_stub.auralith_llm_api_key     = "REDACTED_IN_TEST"
_config_stub.auralith_llm_model       = "llama-3.1-8b-instant"
_config_stub.auralith_llm_timeout     = 20
_config_stub.auralith_llm_max_tokens  = 500


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fake_response(body: dict, status: int = 200):
    """Create a fake urllib response with .read() and .status."""
    raw = json.dumps(body).encode()
    resp = MagicMock()
    resp.read.return_value = raw
    resp.status = status
    resp.__enter__ = lambda s: s
    resp.__exit__  = MagicMock(return_value=False)
    return resp


def _groq_body(content: str) -> dict:
    """Minimal Groq / OpenAI chat completions response."""
    return {
        "choices": [{"message": {"content": content}, "finish_reason": "stop"}],
        "model": "llama-3.1-8b-instant",
    }


def _anthropic_body(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}]}


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestCallLlmGroq(unittest.TestCase):

    def setUp(self):
        # Reset config to openai_compatible / groq defaults for each test
        _config_stub.auralith_llm_provider   = "openai_compatible"
        _config_stub.auralith_llm_endpoint   = "https://api.groq.com/openai/v1/chat/completions"
        _config_stub.auralith_llm_api_key    = "REDACTED_IN_TEST"
        _config_stub.auralith_llm_model      = "llama-3.1-8b-instant"
        _config_stub.auralith_llm_timeout    = 20
        _config_stub.auralith_llm_max_tokens = 500
        # Swap the engine's bound Config to the stub for the duration of the
        # test, then restore automatically. This guarantees _call_llm reads the
        # stub (never the live .env config) regardless of test execution order.
        patcher = patch("services.auralith_engine.Config", new=_config_stub)
        patcher.start()
        self.addCleanup(patcher.stop)

    # ── 1. Groq success ──────────────────────────────────────────────────────

    def test_groq_success_returns_text(self):
        expected = "This artist orbits the high-energy, low-valence quadrant."
        with patch("urllib.request.urlopen", return_value=_fake_response(_groq_body(expected))):
            result = _call_llm("system prompt", "user message")

        self.assertEqual(result["text"], expected)
        self.assertEqual(result["provider"], "openai_compatible")
        self.assertEqual(result["llm_model"], "llama-3.1-8b-instant")
        self.assertIsNone(result["fallback_reason"])

    def test_groq_request_uses_bearer_auth(self):
        """Authorization header must be 'Bearer <key>', NOT x-api-key."""
        captured_headers = {}

        def fake_urlopen(req, timeout=None):
            captured_headers.update(dict(req.headers))
            return _fake_response(_groq_body("ok"))

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            _call_llm("sys", "usr")

        # Bearer present
        self.assertIn("Authorization", captured_headers)
        self.assertTrue(captured_headers["Authorization"].startswith("Bearer "))
        # x-api-key must NOT be present (that's the Anthropic header)
        self.assertNotIn("X-api-key", captured_headers)

    def test_groq_request_body_uses_messages_array_with_system_role(self):
        """OpenAI-compatible payload must use messages=[{role:system,...},{role:user,...}]."""
        captured_body = {}

        def fake_urlopen(req, timeout=None):
            captured_body.update(json.loads(req.data.decode()))
            return _fake_response(_groq_body("ok"))

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            _call_llm("my system", "my user")

        msgs = captured_body.get("messages", [])
        roles = [m["role"] for m in msgs]
        self.assertIn("system", roles, "messages array must contain a system role")
        self.assertIn("user",   roles, "messages array must contain a user role")
        self.assertNotIn("system", captured_body, "system must NOT be a top-level key for openai_compatible")

    # ── 2. Anthropic success ─────────────────────────────────────────────────

    def test_anthropic_success_returns_text(self):
        _config_stub.auralith_llm_provider = "anthropic"
        expected = "You inhabit the melancholic drift zone."
        with patch("urllib.request.urlopen", return_value=_fake_response(_anthropic_body(expected))):
            result = _call_llm("sys", "usr")

        self.assertEqual(result["text"], expected)
        self.assertIsNone(result["fallback_reason"])

    def test_anthropic_request_uses_x_api_key_header(self):
        _config_stub.auralith_llm_provider = "anthropic"
        captured_headers = {}

        def fake_urlopen(req, timeout=None):
            captured_headers.update(dict(req.headers))
            return _fake_response(_anthropic_body("hi"))

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            _call_llm("sys", "usr")

        self.assertIn("X-api-key", captured_headers)
        self.assertNotIn("Authorization", captured_headers)

    # ── 3. 401 auth error ────────────────────────────────────────────────────

    def test_401_returns_auth_error_fallback(self):
        http_err = urllib.error.HTTPError(
            url="https://api.groq.com/openai/v1/chat/completions",
            code=401, msg="Unauthorized", hdrs=None, fp=None,
        )
        with patch("urllib.request.urlopen", side_effect=http_err):
            result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["fallback_reason"], "auth_error")

    # ── 4. 429 rate limited ──────────────────────────────────────────────────

    def test_429_returns_rate_limited_fallback(self):
        http_err = urllib.error.HTTPError(
            url="https://api.groq.com/openai/v1/chat/completions",
            code=429, msg="Too Many Requests", hdrs=None, fp=None,
        )
        with patch("urllib.request.urlopen", side_effect=http_err):
            result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["fallback_reason"], "rate_limited")

    # ── 5. Timeout ───────────────────────────────────────────────────────────

    def test_timeout_returns_llm_timeout_fallback(self):
        url_err = urllib.error.URLError(reason="timed out")
        with patch("urllib.request.urlopen", side_effect=url_err):
            result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["fallback_reason"], "llm_timeout")

    # ── 6. Empty response ────────────────────────────────────────────────────

    def test_empty_choices_content_returns_fallback(self):
        body = {"choices": [{"message": {"content": "   "}, "finish_reason": "stop"}]}
        with patch("urllib.request.urlopen", return_value=_fake_response(body)):
            result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["fallback_reason"], "llm_empty_response")

    # ── 7. No endpoint configured ────────────────────────────────────────────

    def test_no_endpoint_returns_not_configured(self):
        _config_stub.auralith_llm_endpoint = None
        result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["provider"], "none")
        self.assertEqual(result["fallback_reason"], "llm_not_configured")

    def test_no_api_key_returns_not_configured(self):
        _config_stub.auralith_llm_api_key = None
        result = _call_llm("sys", "usr")

        self.assertIsNone(result["text"])
        self.assertEqual(result["fallback_reason"], "llm_not_configured")

    # ── 8. API key never logged ──────────────────────────────────────────────

    def test_api_key_never_appears_in_log_on_error(self):
        """Logger must not receive the API key string under any failure path."""
        secret = "gsk_super_secret_key_must_not_leak"
        _config_stub.auralith_llm_api_key = secret

        log_calls: list[str] = []

        def capture_log(payload, *args, **kwargs):
            log_calls.append(json.dumps(payload, default=str))

        mock_logger = MagicMock()
        mock_logger.warning.side_effect = capture_log

        http_err = urllib.error.HTTPError(
            url="https://api.groq.com/openai/v1/chat/completions",
            code=401, msg="Unauthorized", hdrs=None, fp=None,
        )
        with patch("urllib.request.urlopen", side_effect=http_err), \
             patch("services.auralith_engine.logger", mock_logger):
            _call_llm("sys", "usr")

        combined = " ".join(log_calls)
        self.assertNotIn(secret, combined, "API key must NEVER appear in log output")


if __name__ == "__main__":
    unittest.main()

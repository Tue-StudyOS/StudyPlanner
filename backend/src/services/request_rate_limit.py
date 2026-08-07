from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

from db.d1 import fetch_one
from http_utils import get_request_header


@dataclass(frozen=True)
class RateLimitPolicy:
    scope: str
    maximum_requests: int
    window_seconds: int


AUTH_LOGIN_POLICY = RateLimitPolicy('auth_login', maximum_requests=10, window_seconds=15 * 60)
AUTH_REGISTRATION_POLICY = RateLimitPolicy('auth_registration', maximum_requests=5, window_seconds=60 * 60)
FEEDBACK_POLICY = RateLimitPolicy('feedback', maximum_requests=5, window_seconds=60 * 60)
AI_CATALOG_POLICY = RateLimitPolicy('ai_catalog', maximum_requests=30, window_seconds=60)
CLIENT_ERROR_POLICY = RateLimitPolicy('client_error', maximum_requests=30, window_seconds=60 * 60)
# Reviews already require an account, which is the real defence against skewed
# averages; this only stops a runaway client from hammering the write path.
COURSE_REVIEW_POLICY = RateLimitPolicy('course_review', maximum_requests=20, window_seconds=60 * 60)


class RateLimitError(PermissionError):
    """Raised when a public mutation or expensive request exceeds its limit."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__('Too many requests. Please try again later.')
        self.retry_after_seconds = retry_after_seconds


def _client_key(request: Any) -> str:
    """Return a non-reversible storage key without retaining raw client IPs."""
    client_ip = get_request_header(request, 'CF-Connecting-IP') or 'unknown'
    return hashlib.sha256(client_ip.encode('utf-8')).hexdigest()


def _window_start(now_unix: int, window_seconds: int) -> int:
    return now_unix - (now_unix % window_seconds)


async def enforce_rate_limit(
    env: Any,
    request: Any,
    policy: RateLimitPolicy,
    *,
    now_unix: int | None = None,
) -> None:
    """Atomically record a request and reject it once its fixed window is full."""
    current_unix = int(time.time()) if now_unix is None else now_unix
    window_start_unix = _window_start(current_unix, policy.window_seconds)
    row = await fetch_one(
        env,
        """
        INSERT INTO request_rate_limits (scope, client_key, window_started_at_unix, request_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(scope, client_key) DO UPDATE SET
            window_started_at_unix = excluded.window_started_at_unix,
            request_count = CASE
                WHEN request_rate_limits.window_started_at_unix = excluded.window_started_at_unix
                THEN request_rate_limits.request_count + 1
                ELSE 1
            END
        RETURNING request_count AS requestCount
        """,
        [policy.scope, _client_key(request), window_start_unix],
    )
    request_count = int(row.get('requestCount', 0)) if row else 0
    if request_count > policy.maximum_requests:
        retry_after_seconds = max(1, window_start_unix + policy.window_seconds - current_unix)
        raise RateLimitError(retry_after_seconds)

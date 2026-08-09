from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

from db.d1 import execute, fetch_one
from http_utils import get_request_header


@dataclass(frozen=True)
class RateLimitPolicy:
    scope: str
    maximum_requests: int
    window_seconds: int


# Login is limited per account and counts only failed attempts, so the ceiling
# exists to slow password guessing rather than to shape traffic. It is kept
# deliberately high: locking out a whole lecture hall behind one campus NAT is a
# far more likely outcome than an actual brute-force attempt.
AUTH_LOGIN_POLICY = RateLimitPolicy('auth_login', maximum_requests=500, window_seconds=15 * 60)
AUTH_REGISTRATION_POLICY = RateLimitPolicy('auth_registration', maximum_requests=50, window_seconds=60 * 60)
FEEDBACK_POLICY = RateLimitPolicy('feedback', maximum_requests=5, window_seconds=60 * 60)
AI_CATALOG_POLICY = RateLimitPolicy('ai_catalog', maximum_requests=30, window_seconds=60)
CLIENT_ERROR_POLICY = RateLimitPolicy('client_error', maximum_requests=30, window_seconds=60 * 60)
# Reviews already require an account, which is the real defence against skewed
# averages; this only stops a runaway client from hammering the write path.
COURSE_REVIEW_POLICY = RateLimitPolicy('course_review', maximum_requests=20, window_seconds=60 * 60)
REVIEW_NOTICE_POLICY = RateLimitPolicy('review_notice', maximum_requests=5, window_seconds=60 * 60)


class RateLimitError(PermissionError):
    """Raised when a public mutation or expensive request exceeds its limit."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__('Too many requests. Please try again later.')
        self.retry_after_seconds = retry_after_seconds


def _client_key(request: Any) -> str:
    """Return a non-reversible storage key without retaining raw client IPs."""
    client_ip = get_request_header(request, 'CF-Connecting-IP') or 'unknown'
    return hashlib.sha256(client_ip.encode('utf-8')).hexdigest()


def account_rate_limit_key(identifier: Any) -> str | None:
    """Return the stored login-limit key for a non-empty account identifier."""
    normalized_identifier = str(identifier or '').strip().lower()
    if not normalized_identifier:
        return None
    return hashlib.sha256(f'account:{normalized_identifier}'.encode('utf-8')).hexdigest()


def _account_key(request: Any, identifier: Any) -> str:
    """Return a non-reversible storage key for the account being signed into.

    Keying failed logins on the account rather than the client IP is what keeps
    twenty students behind one campus NAT independent of each other. The prefix
    keeps this key space disjoint from _client_key's.
    """
    stored_key = account_rate_limit_key(identifier)
    if stored_key is None:
        # A request with no identifier can never authenticate; fall back to the
        # IP so a flood of malformed bodies is still bounded.
        return _client_key(request)
    return stored_key


def _window_start(now_unix: int, window_seconds: int) -> int:
    return now_unix - (now_unix % window_seconds)


def _retry_after_seconds(window_start_unix: int, policy: RateLimitPolicy, current_unix: int) -> int:
    return max(1, window_start_unix + policy.window_seconds - current_unix)


async def _increment_window(
    env: Any,
    policy: RateLimitPolicy,
    client_key: str,
    window_start_unix: int,
    current_unix: int,
) -> int:
    """Atomically add one request to the window and return the new count."""
    await execute(
        env,
        """
        DELETE FROM request_rate_limits
        WHERE scope = ?
          AND window_started_at_unix + ? < ?
        """,
        [policy.scope, policy.window_seconds, current_unix - (24 * 60 * 60)],
    )
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
        [policy.scope, client_key, window_start_unix],
    )
    return int(row.get('requestCount', 0)) if row else 0


async def _read_window_count(
    env: Any,
    policy: RateLimitPolicy,
    client_key: str,
    window_start_unix: int,
) -> int:
    """Return the count already recorded for this window, ignoring stale windows."""
    row = await fetch_one(
        env,
        """
        SELECT request_count AS requestCount
        FROM request_rate_limits
        WHERE scope = ? AND client_key = ? AND window_started_at_unix = ?
        """,
        [policy.scope, client_key, window_start_unix],
    )
    return int(row.get('requestCount', 0)) if row else 0


async def enforce_rate_limit(
    env: Any,
    request: Any,
    policy: RateLimitPolicy,
    *,
    now_unix: int | None = None,
) -> None:
    """Atomically record a request and reject it once its fixed window is full.

    Every call costs budget, so this suits volume limits (feedback, AI, client
    error reports) where the request itself is the thing being bounded. Login
    uses the failed-attempt pair below instead.
    """
    current_unix = int(time.time()) if now_unix is None else now_unix
    window_start_unix = _window_start(current_unix, policy.window_seconds)
    request_count = await _increment_window(
        env,
        policy,
        _client_key(request),
        window_start_unix,
        current_unix,
    )
    if request_count > policy.maximum_requests:
        raise RateLimitError(_retry_after_seconds(window_start_unix, policy, current_unix))


async def enforce_failed_attempt_limit(
    env: Any,
    request: Any,
    policy: RateLimitPolicy,
    *,
    identifier: Any,
    now_unix: int | None = None,
) -> None:
    """Reject a login only once the account's window is full of failed attempts.

    This read is deliberately non-charging. Attempts were previously counted
    before authentication ran, so a server-side 5xx — and every client retry it
    provoked — burned the same budget as a wrong password, and an outage locked
    users out for the rest of the window. Pair it with record_failed_attempt().
    """
    current_unix = int(time.time()) if now_unix is None else now_unix
    window_start_unix = _window_start(current_unix, policy.window_seconds)
    failure_count = await _read_window_count(
        env,
        policy,
        _account_key(request, identifier),
        window_start_unix,
    )
    if failure_count >= policy.maximum_requests:
        raise RateLimitError(_retry_after_seconds(window_start_unix, policy, current_unix))


async def record_failed_attempt(
    env: Any,
    request: Any,
    policy: RateLimitPolicy,
    *,
    identifier: Any,
    now_unix: int | None = None,
) -> None:
    """Charge one failed authentication against the account's window."""
    current_unix = int(time.time()) if now_unix is None else now_unix
    window_start_unix = _window_start(current_unix, policy.window_seconds)
    await _increment_window(
        env,
        policy,
        _account_key(request, identifier),
        window_start_unix,
        current_unix,
    )

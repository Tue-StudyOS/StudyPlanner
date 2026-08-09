from __future__ import annotations

import time
from typing import Any

from db.d1 import execute, execute_batch
from services.request_rate_limit import (
    AI_CATALOG_POLICY,
    AUTH_LOGIN_POLICY,
    AUTH_REGISTRATION_POLICY,
    CLIENT_ERROR_POLICY,
    COURSE_REVIEW_POLICY,
    FEEDBACK_POLICY,
    RateLimitPolicy,
)

DAY_SECONDS = 24 * 60 * 60
DIAGNOSTIC_RETENTION_SECONDS = 14 * DAY_SECONDS
RATE_LIMIT_GRACE_SECONDS = DAY_SECONDS

RATE_LIMIT_POLICIES: tuple[RateLimitPolicy, ...] = (
    AI_CATALOG_POLICY,
    AUTH_LOGIN_POLICY,
    AUTH_REGISTRATION_POLICY,
    CLIENT_ERROR_POLICY,
    COURSE_REVIEW_POLICY,
    FEEDBACK_POLICY,
)


def _current_unix(value: int | None) -> int:
    return int(time.time()) if value is None else value


def _rate_limit_cleanup_statement(current_unix: int) -> tuple[str, list[Any]]:
    case_clauses = ' '.join('WHEN ? THEN ?' for _policy in RATE_LIMIT_POLICIES)
    parameters: list[Any] = []
    for policy in RATE_LIMIT_POLICIES:
        parameters.extend([policy.scope, policy.window_seconds])
    parameters.append(current_unix - RATE_LIMIT_GRACE_SECONDS)
    return (
        f"""
        DELETE FROM request_rate_limits
        WHERE window_started_at_unix + (
            CASE scope {case_clauses} ELSE NULL END
        ) < ?
        """,  # noqa: S608 -- clauses come only from fixed policy constants.
        parameters,
    )


def build_retention_statements(current_unix: int) -> list[tuple[str, list[Any]]]:
    """Return only the four allowlisted retention deletes."""
    return [
        (
            'DELETE FROM client_error_log WHERE created_at_unix < ?',
            [current_unix - DIAGNOSTIC_RETENTION_SECONDS],
        ),
        (
            """
            DELETE FROM user_feedback
            WHERE created_at_unix < unixepoch(?, 'unixepoch', '-6 months')
            """,
            [current_unix],
        ),
        _rate_limit_cleanup_statement(current_unix),
        (
            """
            DELETE FROM course_reviews
            WHERE is_hidden = 1
              AND retention_hold = 0
              AND updated_at_unix < unixepoch(?, 'unixepoch', '-6 months')
            """,
            [current_unix],
        ),
    ]


def _change_count(result: Any) -> int:
    if not isinstance(result, dict):
        return 0
    meta = result.get('meta')
    if not isinstance(meta, dict):
        return 0
    try:
        return max(0, int(meta.get('changes', 0)))
    except (TypeError, ValueError):
        return 0


async def run_retention_cleanup(
    env: Any,
    *,
    current_unix: int | None = None,
) -> dict[str, int]:
    """Apply every retention boundary atomically and return aggregate counts."""
    results = await execute_batch(
        env,
        build_retention_statements(_current_unix(current_unix)),
    )
    counts = [_change_count(result) for result in results]
    while len(counts) < 4:
        counts.append(0)
    return {
        'clientDiagnosticsDeleted': counts[0],
        'feedbackDeleted': counts[1],
        'rateLimitsDeleted': counts[2],
        'hiddenReviewsDeleted': counts[3],
    }


async def cleanup_expired_client_diagnostics(
    env: Any,
    *,
    current_unix: int | None = None,
) -> None:
    await execute(
        env,
        'DELETE FROM client_error_log WHERE created_at_unix < ?',
        [_current_unix(current_unix) - DIAGNOSTIC_RETENTION_SECONDS],
    )


async def cleanup_expired_feedback(
    env: Any,
    *,
    current_unix: int | None = None,
) -> None:
    await execute(
        env,
        """
        DELETE FROM user_feedback
        WHERE created_at_unix < unixepoch(?, 'unixepoch', '-6 months')
        """,
        [_current_unix(current_unix)],
    )


async def cleanup_expired_rate_limits(
    env: Any,
    *,
    current_unix: int | None = None,
) -> None:
    sql, parameters = _rate_limit_cleanup_statement(_current_unix(current_unix))
    await execute(env, sql, parameters)


async def cleanup_expired_hidden_reviews(
    env: Any,
    *,
    current_unix: int | None = None,
) -> None:
    await execute(
        env,
        """
        DELETE FROM course_reviews
        WHERE is_hidden = 1
          AND retention_hold = 0
          AND updated_at_unix < unixepoch(?, 'unixepoch', '-6 months')
        """,
        [_current_unix(current_unix)],
    )

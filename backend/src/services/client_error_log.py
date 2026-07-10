from __future__ import annotations

from typing import Any

from db.d1 import execute, fetch_all
from env_config import get_env_value
from services.authentication import get_authenticated_user

MAX_URL_LENGTH = 2048
MAX_MESSAGE_LENGTH = 500
MAX_DETAIL_LENGTH = 4000
MAX_PAGE_PATH_LENGTH = 512
MAX_CODE_LENGTH = 64
MAX_LIST_ENTRIES = 200
MAX_STORED_ENTRIES = 500
ALLOWED_METHODS = {'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'}


class ClientErrorLogError(ValueError):
    """Raised when client error log input is invalid."""


def _safe_text(value: Any, *, max_length: int) -> str:
    text = str(value).strip() if value is not None else ''
    if len(text) > max_length:
        return text[:max_length]
    return text


def _validate_method(value: Any) -> str:
    method = _safe_text(value, max_length=16).upper() or 'GET'
    if method not in ALLOWED_METHODS:
        raise ClientErrorLogError('method is not supported.')
    return method


def _validate_status(value: Any) -> int:
    try:
        status = int(value)
    except (TypeError, ValueError) as exc:
        raise ClientErrorLogError('status must be an integer.') from exc
    if status < 0 or status > 999:
        raise ClientErrorLogError('status is out of range.')
    return status


def _validate_duration_ms(value: Any) -> int | None:
    if value is None or value == '':
        return None
    try:
        duration_ms = int(value)
    except (TypeError, ValueError) as exc:
        raise ClientErrorLogError('durationMs must be an integer.') from exc
    if duration_ms < 0:
        raise ClientErrorLogError('durationMs must be non-negative.')
    return duration_ms


def is_diagnostics_administrator(env: Any, username: str) -> bool:
    """Keep aggregated diagnostics limited to explicitly configured operators."""
    configured_usernames = get_env_value(env, 'DIAGNOSTICS_ADMIN_USERNAMES', '') or ''
    allowed_usernames = {
        value.strip().lower()
        for value in configured_usernames.split(',')
        if value.strip()
    }
    return username.strip().lower() in allowed_usernames


async def report_client_error(env: Any, request: Any, payload: dict[str, Any]) -> dict[str, Any]:
    method = _validate_method(payload.get('method'))
    url = _safe_text(payload.get('url'), max_length=MAX_URL_LENGTH)
    if not url:
        raise ClientErrorLogError('url is required.')

    status = _validate_status(payload.get('status'))
    message = _safe_text(payload.get('message'), max_length=MAX_MESSAGE_LENGTH)
    if not message:
        raise ClientErrorLogError('message is required.')

    code = _safe_text(payload.get('code'), max_length=MAX_CODE_LENGTH) or None
    detail = _safe_text(payload.get('detail'), max_length=MAX_DETAIL_LENGTH) or None
    page_path = _safe_text(payload.get('pagePath'), max_length=MAX_PAGE_PATH_LENGTH) or None
    duration_ms = _validate_duration_ms(payload.get('durationMs'))

    user = await get_authenticated_user(env, request)
    username = str(user['username']) if user and user.get('username') else None

    await execute(
        env,
        """
        INSERT INTO client_error_log (
            method, url, status, code, message, detail, duration_ms, page_path, user_username
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [method, url, status, code, message, detail, duration_ms, page_path, username],
    )

    await execute(
        env,
        """
        DELETE FROM client_error_log
        WHERE id NOT IN (
            SELECT id
            FROM client_error_log
            ORDER BY id DESC
            LIMIT ?
        )
        """,
        [MAX_STORED_ENTRIES],
    )

    return {'ok': True}


async def list_client_errors(env: Any, username: str) -> dict[str, Any]:
    is_administrator = is_diagnostics_administrator(env, username)
    ownership_filter = '' if is_administrator else 'WHERE user_username = ?'
    parameters: list[Any] = [MAX_LIST_ENTRIES] if is_administrator else [username, MAX_LIST_ENTRIES]
    rows = await fetch_all(
        env,
        f"""
        SELECT
            id,
            method,
            url,
            status,
            code,
            message,
            detail,
            duration_ms AS durationMs,
            page_path AS pagePath,
            {'user_username AS userUsername,' if is_administrator else 'NULL AS userUsername,'}
            created_at_unix AS createdAtUnix
        FROM client_error_log
        {ownership_filter}
        ORDER BY id DESC
        LIMIT ?
        """,
        parameters,
    )
    return {'entries': rows, 'scope': 'all' if is_administrator else 'own'}

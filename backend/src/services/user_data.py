from __future__ import annotations

import json
import time
from typing import Any, Literal

from db.d1 import execute, fetch_one

UserStateJsonColumn = Literal['favorites_json', 'semester_plans_json', 'settings_json']
UserProgressJsonColumn = Literal['completed_courses_json', 'transcript_review_items_json']

USER_STATE_JSON_COLUMNS: set[str] = {'favorites_json', 'semester_plans_json', 'settings_json'}
USER_PROGRESS_JSON_COLUMNS: set[str] = {'completed_courses_json', 'transcript_review_items_json'}


def now_unix() -> int:
    return int(time.time())


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def parse_json_array(value: Any) -> list[Any]:
    if not value:
        return []
    try:
        parsed_value = json.loads(str(value))
    except (TypeError, ValueError):
        return []
    return parsed_value if isinstance(parsed_value, list) else []


def parse_json_object(value: Any) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed_value = json.loads(str(value))
    except (TypeError, ValueError):
        return {}
    if not isinstance(parsed_value, dict):
        return {}
    return {str(key): item for key, item in parsed_value.items()}


def _validate_state_column(column_name: str) -> UserStateJsonColumn:
    if column_name not in USER_STATE_JSON_COLUMNS:
        raise ValueError(f'Unsupported user_state JSON column: {column_name}')
    return column_name  # type: ignore[return-value]


def _validate_progress_column(column_name: str) -> UserProgressJsonColumn:
    if column_name not in USER_PROGRESS_JSON_COLUMNS:
        raise ValueError(f'Unsupported user_progress JSON column: {column_name}')
    return column_name  # type: ignore[return-value]


async def ensure_user_state(env: Any, username: str) -> None:
    now_value = now_unix()
    await execute(
        env,
        """
        INSERT OR IGNORE INTO user_state (
            username,
            display_name,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?)
        """,
        [username, username, now_value, now_value],
    )


async def ensure_user_progress(env: Any, username: str) -> None:
    now_value = now_unix()
    await execute(
        env,
        """
        INSERT OR IGNORE INTO user_progress (
            username,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?)
        """,
        [username, now_value, now_value],
    )


async def load_user_state_json(
    env: Any,
    username: str,
    column_name: UserStateJsonColumn,
) -> Any:
    safe_column_name = _validate_state_column(column_name)
    await ensure_user_state(env, username)
    row = await fetch_one(
        env,
        f"SELECT {safe_column_name} AS jsonValue FROM user_state WHERE username = ? LIMIT 1",  # noqa: S608
        [username],
    )
    return row.get('jsonValue') if row else None


async def update_user_state_json(
    env: Any,
    username: str,
    column_name: UserStateJsonColumn,
    value: Any,
) -> None:
    safe_column_name = _validate_state_column(column_name)
    await ensure_user_state(env, username)
    await execute(
        env,
        f"UPDATE user_state SET {safe_column_name} = ?, updated_at_unix = ? WHERE username = ?",  # noqa: S608
        [dumps_json(value), now_unix(), username],
    )


async def load_user_progress_json(
    env: Any,
    username: str,
    column_name: UserProgressJsonColumn,
) -> Any:
    safe_column_name = _validate_progress_column(column_name)
    await ensure_user_progress(env, username)
    row = await fetch_one(
        env,
        f"SELECT {safe_column_name} AS jsonValue FROM user_progress WHERE username = ? LIMIT 1",  # noqa: S608
        [username],
    )
    return row.get('jsonValue') if row else None


async def update_user_progress_json(
    env: Any,
    username: str,
    column_name: UserProgressJsonColumn,
    value: Any,
) -> None:
    safe_column_name = _validate_progress_column(column_name)
    await ensure_user_progress(env, username)
    await execute(
        env,
        f"UPDATE user_progress SET {safe_column_name} = ?, updated_at_unix = ? WHERE username = ?",  # noqa: S608
        [dumps_json(value), now_unix(), username],
    )

from __future__ import annotations

from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.user_data import load_user_state_json, parse_json_array, update_user_state_json


class FavoriteUpdateError(ValueError):
    """Raised when a favorite update payload is invalid."""


def _normalize_stored_course_ids(values: list[Any]) -> list[str]:
    normalized_ids: list[str] = []
    seen_ids: set[int] = set()
    for raw_value in values:
        try:
            course_id = int(raw_value)
        except (TypeError, ValueError):
            continue
        if course_id in seen_ids:
            continue
        seen_ids.add(course_id)
        normalized_ids.append(str(course_id))
    return normalized_ids


async def _list_favorite_course_ids(env: Any, username: str) -> list[str]:
    stored_value = await load_user_state_json(env, username, 'favorites_json')
    course_ids = [int(course_id) for course_id in _normalize_stored_course_ids(parse_json_array(stored_value))]
    existing_course_ids = await _filter_existing_course_ids(env, course_ids)
    if existing_course_ids != course_ids:
        await update_user_state_json(
            env,
            username,
            'favorites_json',
            [str(course_id) for course_id in existing_course_ids],
        )
    return [str(course_id) for course_id in existing_course_ids]


def _normalize_course_ids(payload: dict[str, Any]) -> list[int]:
    raw_course_ids = payload.get('favoriteCourseIds')
    if raw_course_ids is None:
        raw_course_ids = payload.get('courseIds')

    if raw_course_ids is None:
        raise FavoriteUpdateError('A favoriteCourseIds array is required.')
    if not isinstance(raw_course_ids, list):
        raise FavoriteUpdateError('favoriteCourseIds must be an array.')

    normalized_ids: list[int] = []
    seen_ids: set[int] = set()
    for raw_value in raw_course_ids:
        try:
            course_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise FavoriteUpdateError('Favorite course ids must be numeric.') from exc
        if course_id in seen_ids:
            continue
        seen_ids.add(course_id)
        normalized_ids.append(course_id)
    return normalized_ids


async def _filter_existing_course_ids(env: Any, course_ids: list[int]) -> list[int]:
    if not course_ids:
        return []

    placeholders = ', '.join('?' for _ in course_ids)
    rows = await fetch_all(
        env,
        f'SELECT id FROM courses WHERE id IN ({placeholders})',
        course_ids,
    )
    existing_ids = {int(row['id']) for row in rows}
    return [course_id for course_id in course_ids if course_id in existing_ids]


async def get_current_user_favorites(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    favorite_course_ids = await _list_favorite_course_ids(env, str(user['username']))
    return {
        'favoriteCourseIds': favorite_course_ids,
        'count': len(favorite_course_ids),
    }


async def replace_current_user_favorites(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    course_ids = _normalize_course_ids(payload)
    existing_course_ids = await _filter_existing_course_ids(env, course_ids)

    await update_user_state_json(
        env,
        username,
        'favorites_json',
        [str(course_id) for course_id in existing_course_ids],
    )

    favorite_course_ids = await _list_favorite_course_ids(env, username)
    return {
        'favoriteCourseIds': favorite_course_ids,
        'count': len(favorite_course_ids),
    }

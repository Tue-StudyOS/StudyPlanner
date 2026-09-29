from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from db.d1 import execute, fetch_all
from services.app_settings import get_simulated_semester_label
from services.authentication import require_authenticated_user
from services.course_catalog import normalize_review_key
from services.user_data import dumps_json, load_user_state_json, now_unix, parse_json_object


class FavoriteUpdateError(ValueError):
    """Raised when a favorite update payload is invalid."""


def _normalize_semester_label(value: Any) -> str:
    if not isinstance(value, str):
        raise FavoriteUpdateError('A semesterLabel is required. Reload the app to use semester-specific Interested lists.')
    label = value.strip().upper()
    summer = re.fullmatch(r'SS (\d{4})', label)
    winter = re.fullmatch(r'WS (\d{4})/(\d{2}|\d{4})', label)
    if summer:
        return label
    if winter and int(winter[2]) == (int(winter[1]) + 1) % (100 if len(winter[2]) == 2 else 10000):
        return f'WS {winter[1]}/{str(int(winter[1]) + 1)[-2:]}'
    raise FavoriteUpdateError('semesterLabel must be SS YYYY or WS YYYY/YY.')


async def _current_semester_label(env: Any) -> str:
    simulated = await get_simulated_semester_label(env)
    if simulated:
        return _normalize_semester_label(simulated)
    now = datetime.now(timezone.utc)
    month = now.month
    if 4 <= month <= 9:
        return f'SS {now.year}'
    year = now.year if month >= 10 else now.year - 1
    return f'WS {year}/{str(year + 1)[-2:]}'


def _normalize_course_ids(payload: dict[str, Any]) -> list[int]:
    raw_course_ids = payload.get('favoriteCourseIds', payload.get('courseIds'))
    if not isinstance(raw_course_ids, list):
        raise FavoriteUpdateError('A favoriteCourseIds array is required.')
    course_ids: list[int] = []
    for value in raw_course_ids:
        if isinstance(value, bool) or not re.fullmatch(r'[1-9]\d*', str(value)):
            raise FavoriteUpdateError('Favorite course ids must be numeric positive integers.')
        course_ids.append(int(value))
    return list(dict.fromkeys(course_ids))


async def _course_keys_for_ids(env: Any, course_ids: list[int]) -> dict[str, str]:
    if not course_ids:
        return {}
    rows = await fetch_all(
        env,
        '''SELECT id, COALESCE(number, unit_id) AS courseKey FROM courses
           WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))''',
        [dumps_json(course_ids)],
    )
    return {
        str(row['id']): key
        for row in rows
        if (key := normalize_review_key(row.get('courseKey')))
    }


async def _load_favorites_by_semester(env: Any, username: str) -> dict[str, list[str]]:
    stored_value = await load_user_state_json(env, username, 'favorites_json')
    try:
        stored = json.loads(str(stored_value or '{}'))
    except ValueError as exc:
        raise FavoriteUpdateError('Stored interested courses could not be read.') from exc
    if isinstance(stored, dict):
        return stored
    if not isinstance(stored, list):
        raise FavoriteUpdateError('Stored interested courses could not be read.')

    # Legacy stars had no semester. Saved plan membership is the only evidence
    # available; unmatched stars stay in the running term, never the new one.
    course_ids = [int(value) for value in stored if re.fullmatch(r'[1-9]\d*', str(value))]
    keys_by_id = await _course_keys_for_ids(env, course_ids)
    plans = parse_json_object(await load_user_state_json(env, username, 'semester_plans_json'))
    favorites: dict[str, list[str]] = {'__legacyCourseIds': [str(value) for value in stored]}
    assigned_ids: set[str] = set()
    for label, plan in plans.items():
        if not isinstance(plan, dict) or not isinstance(plan.get('courseIds'), list):
            continue
        try:
            semester = _normalize_semester_label(label)
        except FavoriteUpdateError:
            continue
        plan_ids = {str(value) for value in plan['courseIds']}
        matched = [str(value) for value in course_ids if str(value) in plan_ids]
        if matched:
            favorites[semester] = list(dict.fromkeys(keys_by_id[value] for value in matched if value in keys_by_id))
            assigned_ids.update(matched)
    remaining_keys = [keys_by_id[str(value)] for value in course_ids if str(value) not in assigned_ids and str(value) in keys_by_id]
    if remaining_keys:
        current_semester = await _current_semester_label(env)
        favorites[current_semester] = list(dict.fromkeys([*favorites.get(current_semester, []), *remaining_keys]))

    # Compare-and-set prevents simultaneous first reads from overwriting a newer
    # semester-specific update. Reads never prune stable keys after a reseed.
    await execute(
        env,
        '''UPDATE user_state SET favorites_json = ?, updated_at_unix = ?
           WHERE username = ? AND favorites_json = ?''',
        [dumps_json(favorites), now_unix(), username, stored_value],
    )
    return parse_json_object(await load_user_state_json(env, username, 'favorites_json'))


async def _favorite_response(env: Any, username: str, semester_label: str) -> dict[str, Any]:
    favorites = await _load_favorites_by_semester(env, username)
    keys = favorites.get(semester_label, [])
    rows = await fetch_all(
        env,
        '''SELECT id, LOWER(TRIM(COALESCE(number, unit_id))) AS courseKey
           FROM courses
           WHERE LOWER(TRIM(COALESCE(number, unit_id))) IN (SELECT value FROM json_each(?))
           ORDER BY id''',
        [dumps_json(keys)],
    )
    # Catalog representatives differ between period slices. Return every current
    # alias so both the catalog star and that semester's grid recognize the key.
    ids_by_key: dict[str, list[str]] = {}
    for row in rows:
        ids_by_key.setdefault(normalize_review_key(row['courseKey']), []).append(str(row['id']))
    groups = [ids_by_key[key] for key in keys if key in ids_by_key]
    return {
        'semesterLabel': semester_label,
        'favoriteCourseIds': [course_id for group in groups for course_id in group],
        'favoriteCourseGroups': groups,
        'count': len(groups),
    }


async def get_current_user_favorites(
    env: Any,
    request: Any,
    semester_label: str | None = None,
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    semester = _normalize_semester_label(semester_label)
    return await _favorite_response(env, str(user['username']), semester)


async def replace_current_user_favorites(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    semester = _normalize_semester_label(payload.get('semesterLabel'))
    username = str(user['username'])
    course_ids = _normalize_course_ids(payload)
    keys_by_id = await _course_keys_for_ids(env, course_ids)
    keys = list(dict.fromkeys(keys_by_id[str(value)] for value in course_ids if str(value) in keys_by_id))
    await _load_favorites_by_semester(env, username)
    # Update just this semester, so two devices planning different semesters
    # cannot replace each other's Interested lists.
    await execute(
        env,
        '''UPDATE user_state SET favorites_json = json_set(favorites_json, ?, json(?)), updated_at_unix = ?
           WHERE username = ?''',
        [f'$."{semester}"', dumps_json(keys), now_unix(), username],
    )
    return await _favorite_response(env, username, semester)

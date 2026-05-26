from __future__ import annotations

import json
import time
from typing import Any

from db.d1 import execute, fetch_all, fetch_one
from services.authentication import require_authenticated_user

MAX_SEMESTER_LABEL_LENGTH = 80
MAX_PLAN_TITLE_LENGTH = 120
MAX_PLAN_NOTES_LENGTH = 4000


class SemesterPlanUpdateError(ValueError):
    """Raised when semester-plan persistence input is invalid."""


class SemesterPlanPayload(dict[str, Any]):
    pass


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _now_unix() -> int:
    return int(time.time())


def _normalize_semester_label(value: Any) -> str:
    semester_label = _safe_text(value)
    if not semester_label:
        raise SemesterPlanUpdateError('A semester label is required.')
    if len(semester_label) > MAX_SEMESTER_LABEL_LENGTH:
        raise SemesterPlanUpdateError(
            f'Semester labels must be shorter than {MAX_SEMESTER_LABEL_LENGTH + 1} characters.'
        )
    return semester_label


def _normalize_optional_text(
    value: Any,
    *,
    field_name: str,
    max_length: int,
) -> str | None:
    normalized_value = _safe_text(value)
    if normalized_value is None:
        return None
    if len(normalized_value) > max_length:
        raise SemesterPlanUpdateError(
            f'{field_name} must be shorter than {max_length + 1} characters.'
        )
    return normalized_value


def _normalize_course_ids(payload: dict[str, Any]) -> list[int]:
    raw_course_ids = payload.get('courseIds')
    if raw_course_ids is None:
        raise SemesterPlanUpdateError('A courseIds array is required.')
    if not isinstance(raw_course_ids, list):
        raise SemesterPlanUpdateError('courseIds must be an array.')

    normalized_ids: list[int] = []
    seen_ids: set[int] = set()
    for raw_value in raw_course_ids:
        try:
            course_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise SemesterPlanUpdateError('Semester-plan course ids must be numeric.') from exc
        if course_id in seen_ids:
            continue
        seen_ids.add(course_id)
        normalized_ids.append(course_id)
    return normalized_ids


def _normalize_hidden_slot_ids(payload: dict[str, Any]) -> list[str]:
    raw_hidden_slot_ids = payload.get('hiddenSlotIds')
    if raw_hidden_slot_ids is None:
        return []
    if not isinstance(raw_hidden_slot_ids, list):
        raise SemesterPlanUpdateError('hiddenSlotIds must be an array.')

    normalized_ids: list[str] = []
    seen_ids: set[str] = set()
    for raw_value in raw_hidden_slot_ids:
        normalized_slot_id = _safe_text(raw_value)
        if not normalized_slot_id or normalized_slot_id in seen_ids:
            continue
        seen_ids.add(normalized_slot_id)
        normalized_ids.append(normalized_slot_id)
    return normalized_ids


def _normalize_course_assignments(payload: dict[str, Any]) -> dict[str, str]:
    raw = payload.get('courseAssignments')
    if not isinstance(raw, dict):
        return {}
    result: dict[str, str] = {}
    for course_id, area_code in raw.items():
        if area_code and isinstance(area_code, str) and area_code.strip():
            result[str(course_id)] = area_code.strip()
    return result


async def _validate_course_ids(env: Any, course_ids: list[int]) -> None:
    if not course_ids:
        return

    placeholders = ', '.join('?' for _ in course_ids)
    rows = await fetch_all(
        env,
        f'SELECT id FROM courses WHERE id IN ({placeholders})',
        course_ids,
    )
    existing_ids = {int(row['id']) for row in rows}
    missing_ids = [course_id for course_id in course_ids if course_id not in existing_ids]
    if missing_ids:
        raise SemesterPlanUpdateError(
            'Unknown course ids in semester-plan payload: '
            + ', '.join(str(course_id) for course_id in missing_ids)
        )


async def _get_plan_header(env: Any, user_id: int, semester_label: str) -> dict[str, Any] | None:
    return await fetch_one(
        env,
        """
        SELECT
            usp.id,
            usp.semester_label AS semesterLabel,
            usp.title,
            usp.notes,
            usp.hidden_slot_ids AS hiddenSlotIds,
            usp.created_at_unix AS createdAtUnix,
            usp.updated_at_unix AS updatedAtUnix
        FROM user_semester_plans AS usp
        WHERE usp.user_id = ?
          AND usp.semester_label = ?
        LIMIT 1
        """,
        [user_id, semester_label],
    )


def _parse_hidden_slot_ids(value: Any) -> list[str]:
    serialized_hidden_slot_ids = _safe_text(value)
    if not serialized_hidden_slot_ids:
        return []
    try:
        parsed_hidden_slot_ids = json.loads(serialized_hidden_slot_ids)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed_hidden_slot_ids, list):
        return []
    return [
        normalized_slot_id
        for item in parsed_hidden_slot_ids
        if (normalized_slot_id := _safe_text(item))
    ]


async def _serialize_plan(env: Any, user_id: int, semester_label: str) -> dict[str, Any] | None:
    header = await _get_plan_header(env, user_id, semester_label)
    if header is None:
        return None

    course_rows = await fetch_all(
        env,
        """
        SELECT course_id AS courseId, study_area_code AS studyAreaCode
        FROM user_semester_plan_courses
        WHERE plan_id = ?
        ORDER BY position ASC, created_at_unix ASC, course_id ASC
        """,
        [header['id']],
    )
    course_ids = [str(int(row['courseId'])) for row in course_rows]
    course_assignments = {
        str(int(row['courseId'])): row['studyAreaCode']
        for row in course_rows
        if row.get('studyAreaCode')
    }
    return {
        'semesterLabel': header['semesterLabel'],
        'title': header.get('title'),
        'notes': header.get('notes'),
        'courseIds': course_ids,
        'hiddenSlotIds': _parse_hidden_slot_ids(header.get('hiddenSlotIds')),
        'courseAssignments': course_assignments,
        'courseCount': len(course_ids),
        'createdAtUnix': int(header['createdAtUnix']),
        'updatedAtUnix': int(header['updatedAtUnix']),
    }


async def list_current_user_semester_plans(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    rows = await fetch_all(
        env,
        """
        SELECT
            usp.semester_label AS semesterLabel,
            usp.title,
            usp.notes,
            usp.created_at_unix AS createdAtUnix,
            usp.updated_at_unix AS updatedAtUnix,
            COUNT(uspc.course_id) AS courseCount
        FROM user_semester_plans AS usp
        LEFT JOIN user_semester_plan_courses AS uspc ON uspc.plan_id = usp.id
        WHERE usp.user_id = ?
        GROUP BY usp.id
        ORDER BY usp.updated_at_unix DESC, usp.semester_label DESC
        """,
        [int(user['id'])],
    )
    semester_plans = [
        {
            'semesterLabel': row['semesterLabel'],
            'title': row.get('title'),
            'notes': row.get('notes'),
            'courseCount': int(row.get('courseCount') or 0),
            'createdAtUnix': int(row['createdAtUnix']),
            'updatedAtUnix': int(row['updatedAtUnix']),
        }
        for row in rows
    ]
    return {
        'semesterPlans': semester_plans,
        'count': len(semester_plans),
    }


async def get_current_user_semester_plan(
    env: Any,
    request: Any,
    semester_label: str,
) -> dict[str, Any] | None:
    user = await require_authenticated_user(env, request)
    return await _serialize_plan(env, int(user['id']), _normalize_semester_label(semester_label))


def _normalize_plan_payload(payload: dict[str, Any]) -> SemesterPlanPayload:
    return SemesterPlanPayload(
        title=_normalize_optional_text(
            payload.get('title'),
            field_name='title',
            max_length=MAX_PLAN_TITLE_LENGTH,
        ),
        notes=_normalize_optional_text(
            payload.get('notes'),
            field_name='notes',
            max_length=MAX_PLAN_NOTES_LENGTH,
        ),
        courseIds=_normalize_course_ids(payload),
        hiddenSlotIds=_normalize_hidden_slot_ids(payload),
        courseAssignments=_normalize_course_assignments(payload),
    )


async def replace_current_user_semester_plan(
    env: Any,
    request: Any,
    semester_label: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    user_id = int(user['id'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    normalized_payload = _normalize_plan_payload(payload)
    course_ids = [int(course_id) for course_id in normalized_payload['courseIds']]
    hidden_slot_ids = normalized_payload['hiddenSlotIds']
    course_assignments = normalized_payload['courseAssignments']
    await _validate_course_ids(env, course_ids)

    existing_plan = await _get_plan_header(env, user_id, normalized_semester_label)
    now_unix = _now_unix()

    title_value = normalized_payload['title'] or ''
    notes_value = normalized_payload['notes'] or ''
    hidden_slot_ids_value = json.dumps(hidden_slot_ids) if hidden_slot_ids else ''

    if existing_plan is None:
        await execute(
            env,
            """
            INSERT INTO user_semester_plans (
                user_id,
                semester_label,
                title,
                notes,
                hidden_slot_ids,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?, ?)
            """,
            [
                user_id,
                normalized_semester_label,
                title_value,
                notes_value,
                hidden_slot_ids_value,
                now_unix,
                now_unix,
            ],
        )
        existing_plan = await _get_plan_header(env, user_id, normalized_semester_label)
    else:
        await execute(
            env,
            """
            UPDATE user_semester_plans
            SET
                title = NULLIF(?, ''),
                notes = NULLIF(?, ''),
                hidden_slot_ids = NULLIF(?, ''),
                updated_at_unix = ?
            WHERE id = ?
            """,
            [
                title_value,
                notes_value,
                hidden_slot_ids_value,
                now_unix,
                existing_plan['id'],
            ],
        )

    if existing_plan is None:
        raise SemesterPlanUpdateError('The semester plan could not be saved.')

    plan_id = int(existing_plan['id'])
    await execute(env, 'DELETE FROM user_semester_plan_courses WHERE plan_id = ?', [plan_id])

    for position, course_id in enumerate(course_ids):
        study_area_code = course_assignments.get(str(course_id))
        await execute(
            env,
            """
            INSERT INTO user_semester_plan_courses (
                plan_id,
                course_id,
                position,
                study_area_code,
                created_at_unix
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [plan_id, course_id, position, study_area_code, now_unix],
        )

    saved_plan = await _serialize_plan(env, user_id, normalized_semester_label)
    if saved_plan is None:
        raise SemesterPlanUpdateError('The saved semester plan could not be loaded.')
    return {
        'semesterPlan': saved_plan,
    }


async def delete_current_user_semester_plan(
    env: Any,
    request: Any,
    semester_label: str,
) -> None:
    user = await require_authenticated_user(env, request)
    await execute(
        env,
        'DELETE FROM user_semester_plans WHERE user_id = ? AND semester_label = ?',
        [int(user['id']), _normalize_semester_label(semester_label)],
    )

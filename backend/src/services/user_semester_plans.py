from __future__ import annotations

from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.user_data import (
    load_user_state_json,
    now_unix,
    parse_json_object,
    update_user_state_json,
)

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


def _coerce_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _normalize_course_assignments(payload: dict[str, Any]) -> dict[str, str]:
    raw_assignments = payload.get('courseAssignments')
    if not isinstance(raw_assignments, dict):
        return {}
    result: dict[str, str] = {}
    for course_id, area_code in raw_assignments.items():
        normalized_area_code = _safe_text(area_code)
        if normalized_area_code:
            result[str(course_id)] = normalized_area_code
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


async def _load_semester_plans(env: Any, username: str) -> dict[str, Any]:
    stored_value = await load_user_state_json(env, username, 'semester_plans_json')
    return parse_json_object(stored_value)


def _normalize_stored_plan(semester_label: str, raw_plan: Any) -> dict[str, Any]:
    if not isinstance(raw_plan, dict):
        raw_plan = {}

    course_ids = []
    for raw_course_id in raw_plan.get('courseIds') or []:
        try:
            course_ids.append(str(int(raw_course_id)))
        except (TypeError, ValueError):
            continue

    hidden_slot_ids = [
        slot_id
        for raw_slot_id in raw_plan.get('hiddenSlotIds') or []
        if (slot_id := _safe_text(raw_slot_id))
    ]
    raw_course_assignments = raw_plan.get('courseAssignments')
    course_assignments: dict[str, str] = {}
    if isinstance(raw_course_assignments, dict):
        for course_id, raw_area_code in raw_course_assignments.items():
            normalized_area_code = _safe_text(raw_area_code)
            if normalized_area_code:
                course_assignments[str(course_id)] = normalized_area_code

    created_at_unix = _coerce_int(raw_plan.get('createdAtUnix') or raw_plan.get('created_at_unix') or 0)
    updated_at_unix = _coerce_int(raw_plan.get('updatedAtUnix') or raw_plan.get('updated_at_unix') or created_at_unix or 0)

    return {
        'semesterLabel': _safe_text(raw_plan.get('semesterLabel')) or semester_label,
        'title': _safe_text(raw_plan.get('title')),
        'notes': _safe_text(raw_plan.get('notes')),
        'courseIds': course_ids,
        'hiddenSlotIds': hidden_slot_ids,
        'courseAssignments': course_assignments,
        'courseCount': len(course_ids),
        'createdAtUnix': created_at_unix,
        'updatedAtUnix': updated_at_unix,
    }


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


async def list_current_user_semester_plans(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    raw_plans = await _load_semester_plans(env, username)
    semester_plans = [
        {
            key: value
            for key, value in _normalize_stored_plan(semester_label, raw_plan).items()
            if key not in {'courseIds', 'hiddenSlotIds', 'courseAssignments'}
        }
        for semester_label, raw_plan in raw_plans.items()
    ]
    semester_plans.sort(key=lambda plan: (-int(plan.get('updatedAtUnix') or 0), str(plan.get('semesterLabel') or '')))
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
    username = str(user['username'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    raw_plans = await _load_semester_plans(env, username)
    raw_plan = raw_plans.get(normalized_semester_label)
    if raw_plan is None:
        return None
    return _normalize_stored_plan(normalized_semester_label, raw_plan)


async def replace_current_user_semester_plan(
    env: Any,
    request: Any,
    semester_label: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    normalized_payload = _normalize_plan_payload(payload)
    course_ids = [int(course_id) for course_id in normalized_payload['courseIds']]
    await _validate_course_ids(env, course_ids)

    raw_plans = await _load_semester_plans(env, username)
    existing_plan = _normalize_stored_plan(
        normalized_semester_label,
        raw_plans.get(normalized_semester_label),
    ) if normalized_semester_label in raw_plans else None
    current_unix = now_unix()
    created_at_unix = int(existing_plan['createdAtUnix']) if existing_plan else current_unix

    raw_plans[normalized_semester_label] = {
        'semesterLabel': normalized_semester_label,
        'title': normalized_payload['title'],
        'notes': normalized_payload['notes'],
        'courseIds': [str(course_id) for course_id in course_ids],
        'hiddenSlotIds': normalized_payload['hiddenSlotIds'],
        'courseAssignments': normalized_payload['courseAssignments'],
        'createdAtUnix': created_at_unix,
        'updatedAtUnix': current_unix,
    }
    await update_user_state_json(env, username, 'semester_plans_json', raw_plans)

    return {
        'semesterPlan': _normalize_stored_plan(
            normalized_semester_label,
            raw_plans[normalized_semester_label],
        ),
    }


async def delete_current_user_semester_plan(
    env: Any,
    request: Any,
    semester_label: str,
) -> None:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    raw_plans = await _load_semester_plans(env, username)
    raw_plans.pop(normalized_semester_label, None)
    await update_user_state_json(env, username, 'semester_plans_json', raw_plans)

from __future__ import annotations

from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.planner_assignments import validate_plan_course_assignments
from services.user_data import (
    load_user_state_json,
    now_unix as _now_unix,
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


def _normalize_stored_plan_course_ids(raw_course_ids: Any) -> list[str]:
    if not isinstance(raw_course_ids, list):
        return []
    normalized_ids: list[str] = []
    seen_ids: set[int] = set()
    for raw_value in raw_course_ids:
        try:
            course_id = int(raw_value)
        except (TypeError, ValueError):
            continue
        if course_id in seen_ids:
            continue
        seen_ids.add(course_id)
        normalized_ids.append(str(course_id))
    return normalized_ids


def _normalize_stored_hidden_slot_ids(raw_hidden_slot_ids: Any) -> list[str]:
    if not isinstance(raw_hidden_slot_ids, list):
        return []
    normalized_ids: list[str] = []
    seen_ids: set[str] = set()
    for raw_value in raw_hidden_slot_ids:
        normalized_slot_id = _safe_text(raw_value)
        if not normalized_slot_id or normalized_slot_id in seen_ids:
            continue
        seen_ids.add(normalized_slot_id)
        normalized_ids.append(normalized_slot_id)
    return normalized_ids


def _normalize_stored_assignments(raw_assignments: Any, course_ids: list[str]) -> dict[str, str]:
    if not isinstance(raw_assignments, dict):
        return {}
    course_id_set = set(course_ids)
    normalized_assignments: dict[str, str] = {}
    for raw_course_id, raw_area_code in raw_assignments.items():
        course_id = _safe_text(raw_course_id)
        area_code = _safe_text(raw_area_code)
        if not course_id or not area_code or course_id not in course_id_set:
            continue
        normalized_assignments[course_id] = area_code
    return normalized_assignments


def _coerce_unix(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _serialize_stored_plan(raw_plan: Any, fallback_semester_label: str) -> dict[str, Any] | None:
    if not isinstance(raw_plan, dict):
        return None
    semester_label = _safe_text(raw_plan.get('semesterLabel')) or fallback_semester_label
    try:
        normalized_semester_label = _normalize_semester_label(semester_label)
    except SemesterPlanUpdateError:
        return None

    course_ids = _normalize_stored_plan_course_ids(raw_plan.get('courseIds'))
    course_assignments = _normalize_stored_assignments(raw_plan.get('courseAssignments'), course_ids)
    hidden_slot_ids = _normalize_stored_hidden_slot_ids(raw_plan.get('hiddenSlotIds'))
    created_at_unix = _coerce_unix(raw_plan.get('createdAtUnix'))
    updated_at_unix = _coerce_unix(raw_plan.get('updatedAtUnix'))

    return {
        'semesterLabel': normalized_semester_label,
        'title': _safe_text(raw_plan.get('title')),
        'notes': _safe_text(raw_plan.get('notes')),
        'courseIds': course_ids,
        'hiddenSlotIds': hidden_slot_ids,
        'courseAssignments': course_assignments,
        'courseCount': len(course_ids),
        'createdAtUnix': created_at_unix,
        'updatedAtUnix': updated_at_unix,
    }


async def _load_stored_plans(env: Any, username: str) -> dict[str, dict[str, Any]]:
    stored_value = await load_user_state_json(env, username, 'semester_plans_json')
    stored_plans = parse_json_object(stored_value)
    serialized_plans: dict[str, dict[str, Any]] = {}
    for semester_label, raw_plan in stored_plans.items():
        serialized_plan = _serialize_stored_plan(raw_plan, semester_label)
        if serialized_plan is None:
            continue
        serialized_plans[str(serialized_plan['semesterLabel'])] = serialized_plan
    return serialized_plans


async def list_current_user_semester_plans(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    stored_plans = await _load_stored_plans(env, str(user['username']))
    semester_plans = sorted(
        [
            {
                'semesterLabel': plan['semesterLabel'],
                'title': plan.get('title'),
                'notes': plan.get('notes'),
                'courseCount': int(plan.get('courseCount') or 0),
                'createdAtUnix': int(plan.get('createdAtUnix') or 0),
                'updatedAtUnix': int(plan.get('updatedAtUnix') or 0),
            }
            for plan in stored_plans.values()
        ],
        key=lambda plan: (int(plan['updatedAtUnix']), str(plan['semesterLabel'])),
        reverse=True,
    )
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
    stored_plans = await _load_stored_plans(env, str(user['username']))
    return stored_plans.get(_normalize_semester_label(semester_label))


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
    username = str(user['username'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    normalized_payload = _normalize_plan_payload(payload)
    course_ids = [int(course_id) for course_id in normalized_payload['courseIds']]
    hidden_slot_ids = normalized_payload['hiddenSlotIds']
    await _validate_course_ids(env, course_ids)

    validated_assignments = await validate_plan_course_assignments(
        env,
        user,
        course_ids,
        normalized_payload['courseAssignments'],
    )

    stored_plans = await _load_stored_plans(env, username)
    existing_plan = stored_plans.get(normalized_semester_label)
    current_unix = _now_unix()
    stored_plans[normalized_semester_label] = {
        'semesterLabel': normalized_semester_label,
        'title': normalized_payload['title'],
        'notes': normalized_payload['notes'],
        'courseIds': [str(course_id) for course_id in course_ids],
        'hiddenSlotIds': hidden_slot_ids,
        'courseAssignments': validated_assignments,
        'courseCount': len(course_ids),
        'createdAtUnix': int(existing_plan['createdAtUnix']) if existing_plan else current_unix,
        'updatedAtUnix': current_unix,
    }

    await update_user_state_json(env, username, 'semester_plans_json', stored_plans)
    saved_plan = stored_plans.get(normalized_semester_label)
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
    username = str(user['username'])
    normalized_semester_label = _normalize_semester_label(semester_label)
    stored_plans = await _load_stored_plans(env, username)
    if normalized_semester_label in stored_plans:
        del stored_plans[normalized_semester_label]
        await update_user_state_json(env, username, 'semester_plans_json', stored_plans)

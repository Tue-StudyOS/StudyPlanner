from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.regulation_assignment_options import (
    load_regulation_course_options,
    load_regulation_rule_groups,
    normalize_optional_float as _normalize_float,
    normalize_study_area_code as _normalize_study_area_code,
    safe_text as _safe_text,
)
from services.user_data import load_user_progress_json, parse_json_array


class PlannerAssignmentError(ValueError):
    """Raised when planner regulation assignments are invalid."""


@dataclass(frozen=True)
class RuleGroup:
    code: str
    name: str
    group_type: str
    required_ects: float | None
    max_ects: float | None
    sort_order: int


@dataclass(frozen=True)
class CourseOption:
    course_id: int
    area_code: str
    area_name: str
    group_type: str
    sort_order: int
    ects_counted: float


@dataclass(frozen=True)
class PlannedCourse:
    course_id: int
    title: str
    ects: float


def _effective_capacity(rule_group: RuleGroup) -> float | None:
    if rule_group.max_ects is not None:
        return rule_group.max_ects
    return rule_group.required_ects


async def load_rule_groups_for_regulation(
    env: Any,
    regulation_version_id: int | None,
) -> dict[str, RuleGroup]:
    if regulation_version_id is None:
        return {}

    rows = await load_regulation_rule_groups(env, regulation_version_id)
    rule_groups: dict[str, RuleGroup] = {}
    for code, row in rows.items():
        rule_groups[code] = RuleGroup(
            code=code,
            name=_safe_text(row.get('name')) or code,
            group_type=_safe_text(row.get('groupType')) or 'study_area',
            required_ects=_normalize_float(row.get('requiredEcts')),
            max_ects=_normalize_float(row.get('maxEcts')),
            sort_order=int(row.get('sortOrder') or 0),
        )
    return rule_groups


async def load_course_options_for_regulation(
    env: Any,
    regulation_version_id: int | None,
    course_ids: list[int],
) -> dict[int, list[CourseOption]]:
    if regulation_version_id is None or not course_ids:
        return {}

    rows = await load_regulation_course_options(
        env,
        regulation_version_id,
        course_ids,
    )
    options_by_course_id: dict[int, list[CourseOption]] = {}
    for course_id, options in rows.items():
        options_by_course_id[course_id] = [
            CourseOption(
                course_id=course_id,
                area_code=str(option['studyAreaCode']),
                area_name=_safe_text(option.get('studyAreaName')) or str(option['studyAreaCode']),
                group_type=_safe_text(option.get('groupType')) or 'study_area',
                sort_order=int(option.get('sortOrder') or 0),
                ects_counted=_normalize_float(option.get('ectsCounted')) or 0.0,
            )
            for option in options
        ]
    return options_by_course_id


async def validate_plan_course_assignments(
    env: Any,
    user: dict[str, Any],
    course_ids: list[int],
    course_assignments: dict[str, str],
) -> dict[str, str]:
    regulation_version_id = (
        int(user['profile']['regulationVersionId'])
        if user['profile'].get('regulationVersionId') is not None
        else None
    )
    if regulation_version_id is None:
        return {}

    course_id_set = {str(course_id) for course_id in course_ids}
    relevant_assignments = {
        str(course_id): _normalize_study_area_code(area_code)
        for course_id, area_code in course_assignments.items()
        if str(course_id) in course_id_set
    }
    relevant_assignments = {
        course_id: area_code
        for course_id, area_code in relevant_assignments.items()
        if area_code is not None
    }
    if not relevant_assignments:
        return {}

    rule_groups = await load_rule_groups_for_regulation(env, regulation_version_id)
    course_options = await load_course_options_for_regulation(env, regulation_version_id, course_ids)
    validated_assignments: dict[str, str] = {}

    for course_id_text, area_code in relevant_assignments.items():
        if area_code not in rule_groups:
            raise PlannerAssignmentError(
                'The selected regulation area is not part of your active examination regulation.'
            )
        course_id = int(course_id_text)
        compatible_area_codes = {option.area_code for option in course_options.get(course_id, [])}
        if area_code not in compatible_area_codes:
            raise PlannerAssignmentError(
                'A planned course was assigned to a regulation area where it cannot be credited.'
            )
        validated_assignments[course_id_text] = area_code

    return validated_assignments


def _normalize_balance_course_ids(payload: dict[str, Any]) -> list[int]:
    raw_course_ids = payload.get('courseIds')
    if raw_course_ids is None:
        raise PlannerAssignmentError('A courseIds array is required.')
    if not isinstance(raw_course_ids, list):
        raise PlannerAssignmentError('courseIds must be an array.')

    course_ids: list[int] = []
    seen_ids: set[int] = set()
    for raw_course_id in raw_course_ids:
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError) as exc:
            raise PlannerAssignmentError('Planner course ids must be numeric.') from exc
        if course_id in seen_ids:
            continue
        seen_ids.add(course_id)
        course_ids.append(course_id)
    return course_ids


def _normalize_balance_assignments(payload: dict[str, Any]) -> dict[str, str]:
    raw_assignments = payload.get('courseAssignments')
    if not isinstance(raw_assignments, dict):
        return {}
    assignments: dict[str, str] = {}
    for raw_course_id, raw_area_code in raw_assignments.items():
        area_code = _normalize_study_area_code(raw_area_code)
        if not area_code:
            continue
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError):
            continue
        assignments[str(course_id)] = area_code
    return assignments


async def _load_planned_courses(env: Any, course_ids: list[int]) -> dict[int, PlannedCourse]:
    if not course_ids:
        return {}

    placeholders = ', '.join('?' for _ in course_ids)
    rows = await fetch_all(
        env,
        f"""
        SELECT
            c.id,
            c.title,
            MAX(rcm.ects_counted) AS mappedEcts
        FROM courses AS c
        LEFT JOIN regulation_course_mappings AS rcm ON rcm.course_id = c.id
        WHERE c.id IN ({placeholders})
        GROUP BY c.id, c.title
        """,
        course_ids,
    )
    return {
        int(row['id']): PlannedCourse(
            course_id=int(row['id']),
            title=_safe_text(row.get('title')) or 'Untitled course',
            ects=_normalize_float(row.get('mappedEcts')) or 0.0,
        )
        for row in rows
    }


def _coerce_completed_course_record(raw_course: Any) -> tuple[int | None, str | None, float] | None:
    if not isinstance(raw_course, dict):
        return None

    course_id: int | None = None
    raw_course_id = raw_course.get('courseId')
    if raw_course_id not in {None, ''}:
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError):
            course_id = None

    return (
        course_id,
        _normalize_study_area_code(raw_course.get('studyAreaCode')),
        _normalize_float(raw_course.get('ects')) or 0.0,
    )


async def _load_completed_ects_by_area(
    env: Any,
    username: str,
    rule_groups: dict[str, RuleGroup],
) -> tuple[dict[str, float], set[int]]:
    stored_value = await load_user_progress_json(env, username, 'completed_courses_json')
    completed_ects_by_area: dict[str, float] = {code: 0.0 for code in rule_groups}
    completed_course_ids: set[int] = set()

    for raw_course in parse_json_array(stored_value):
        completed_course = _coerce_completed_course_record(raw_course)
        if completed_course is None:
            continue
        course_id, area_code, ects = completed_course
        if course_id is not None:
            completed_course_ids.add(course_id)
        if area_code not in rule_groups:
            continue
        completed_ects_by_area[area_code] = completed_ects_by_area.get(area_code, 0.0) + ects

    return completed_ects_by_area, completed_course_ids


def _area_has_capacity(
    rule_group: RuleGroup,
    current_total: float,
    additional_ects: float,
) -> bool:
    capacity = _effective_capacity(rule_group)
    return capacity is None or current_total + additional_ects <= capacity + 0.0001


def _score_solution(
    assignments: dict[int, str],
    area_totals: dict[str, float],
    preferred_assignments: dict[str, str],
    rule_groups: dict[str, RuleGroup],
) -> tuple[int, float, int, float]:
    assigned_count = len(assignments)
    remaining_capacity = 0.0
    for area_code, rule_group in rule_groups.items():
        capacity = _effective_capacity(rule_group)
        if capacity is None:
            continue
        remaining_capacity += max(0.0, capacity - area_totals.get(area_code, 0.0))
    kept_preferences = sum(
        1
        for course_id, area_code in assignments.items()
        if preferred_assignments.get(str(course_id)) == area_code
    )
    sort_penalty = sum(rule_groups[area_code].sort_order for area_code in assignments.values())
    return assigned_count, -remaining_capacity, kept_preferences, -sort_penalty


def _balance_assignments(
    course_ids: list[int],
    planned_courses: dict[int, PlannedCourse],
    options_by_course_id: dict[int, list[CourseOption]],
    completed_ects_by_area: dict[str, float],
    completed_course_ids: set[int],
    rule_groups: dict[str, RuleGroup],
    preferred_assignments: dict[str, str],
) -> tuple[dict[str, str], list[dict[str, Any]], list[str], list[dict[str, Any]], bool]:
    balance_course_ids = [
        course_id
        for course_id in course_ids
        if course_id in planned_courses and course_id not in completed_course_ids
    ]
    warnings: list[dict[str, Any]] = []
    unassigned_course_ids: list[str] = []
    for course_id in course_ids:
        if course_id not in planned_courses:
            warnings.append(
                {
                    'type': 'unknown_course',
                    'courseId': str(course_id),
                    'message': 'This planned course no longer exists in the catalog.',
                }
            )
            unassigned_course_ids.append(str(course_id))
        elif course_id not in completed_course_ids and not options_by_course_id.get(course_id):
            warnings.append(
                {
                    'type': 'unmapped_course',
                    'courseId': str(course_id),
                    'courseTitle': planned_courses[course_id].title,
                    'message': 'This course has no compatible regulation mapping.',
                }
            )
            unassigned_course_ids.append(str(course_id))

    searchable_course_ids = [
        course_id
        for course_id in balance_course_ids
        if options_by_course_id.get(course_id)
    ]
    ordered_course_ids = sorted(
        searchable_course_ids,
        key=lambda course_id: (
            len(options_by_course_id.get(course_id, [])),
            planned_courses[course_id].title,
            course_id,
        ),
    )

    best_assignments: dict[int, str] = {}
    best_totals: dict[str, float] = dict(completed_ects_by_area)
    best_score: tuple[int, float, int, float] | None = None

    def visit(
        index: int,
        current_assignments: dict[int, str],
        current_totals: dict[str, float],
    ) -> None:
        nonlocal best_assignments, best_totals, best_score

        if index >= len(ordered_course_ids):
            score = _score_solution(
                current_assignments,
                current_totals,
                preferred_assignments,
                rule_groups,
            )
            if best_score is None or score > best_score:
                best_score = score
                best_assignments = dict(current_assignments)
                best_totals = dict(current_totals)
            return

        course_id = ordered_course_ids[index]
        course = planned_courses[course_id]
        options = sorted(
            options_by_course_id.get(course_id, []),
            key=lambda option: (
                0 if preferred_assignments.get(str(course_id)) == option.area_code else 1,
                option.sort_order,
                option.area_code,
            ),
        )
        for option in options:
            rule_group = rule_groups.get(option.area_code)
            if rule_group is None:
                continue
            ects = option.ects_counted or course.ects
            current_total = current_totals.get(option.area_code, 0.0)
            if not _area_has_capacity(rule_group, current_total, ects):
                continue
            next_assignments = {**current_assignments, course_id: option.area_code}
            next_totals = {**current_totals, option.area_code: current_total + ects}
            visit(index + 1, next_assignments, next_totals)

        visit(index + 1, current_assignments, current_totals)

    visit(0, {}, dict(completed_ects_by_area))

    strict_solution_found = len(best_assignments) == len(searchable_course_ids)
    for course_id in searchable_course_ids:
        if course_id not in best_assignments:
            unassigned_course_ids.append(str(course_id))
            warnings.append(
                {
                    'type': 'capacity_unassigned',
                    'courseId': str(course_id),
                    'courseTitle': planned_courses[course_id].title,
                    'message': 'No compatible regulation area has enough remaining ECTS capacity.',
                }
            )

    summary = [
        {
            'areaCode': area_code,
            'areaName': rule_group.name,
            'creditedEcts': round(completed_ects_by_area.get(area_code, 0.0), 2),
            'plannedEcts': round(best_totals.get(area_code, 0.0) - completed_ects_by_area.get(area_code, 0.0), 2),
            'capacityEcts': _effective_capacity(rule_group),
        }
        for area_code, rule_group in sorted(
            rule_groups.items(),
            key=lambda item: (item[1].sort_order, item[0]),
        )
    ]

    return (
        {str(course_id): area_code for course_id, area_code in best_assignments.items()},
        warnings,
        list(dict.fromkeys(unassigned_course_ids)),
        summary,
        strict_solution_found,
    )


async def balance_current_user_semester_plan(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    regulation_version_id = (
        int(user['profile']['regulationVersionId'])
        if user['profile'].get('regulationVersionId') is not None
        else None
    )
    course_ids = _normalize_balance_course_ids(payload)
    preferred_assignments = _normalize_balance_assignments(payload)

    if regulation_version_id is None:
        return {
            'assignments': {},
            'warnings': [
                {
                    'type': 'missing_regulation',
                    'message': 'Set your study program and examination regulation before balancing planner areas.',
                }
            ],
            'unassignedCourseIds': [str(course_id) for course_id in course_ids],
            'summary': [],
            'strictSolutionFound': False,
        }

    rule_groups = await load_rule_groups_for_regulation(env, regulation_version_id)
    planned_courses = await _load_planned_courses(env, course_ids)
    options_by_course_id = await load_course_options_for_regulation(
        env,
        regulation_version_id,
        course_ids,
    )
    completed_ects_by_area, completed_course_ids = await _load_completed_ects_by_area(
        env,
        username,
        rule_groups,
    )
    assignments, warnings, unassigned_course_ids, summary, strict_solution_found = _balance_assignments(
        course_ids,
        planned_courses,
        options_by_course_id,
        completed_ects_by_area,
        completed_course_ids,
        rule_groups,
        preferred_assignments,
    )
    return {
        'assignments': assignments,
        'warnings': warnings,
        'unassignedCourseIds': unassigned_course_ids,
        'summary': summary,
        'strictSolutionFound': strict_solution_found,
    }

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.course_catalog import _extract_ects_from_text, _fetch_catalog_courses_by_ids, _normalize_master_cats
from services.catalog_tree_credits import get_tree_credit_options, get_unambiguous_tree_credits
from services.official_regulations import assessment_type, assignment_limit_error
from services.regulation_assignment_options import (
    load_regulation_course_options,
    compulsory_course_options,
    is_flexible_rule_group,
    study_area_code_to_master_cat,
    has_unresolved_assignment_evidence,
    canonicalize_completed_courses,
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
    course_type: str = ''


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


async def _load_ml_general_cs_eligible_course_ids(env: Any, course_ids: list[int]) -> set[int]:
    if not course_ids:
        return set()
    rows = await fetch_all(
        env,
        """
        SELECT DISTINCT courseId FROM (
            SELECT l.course_id AS courseId
            FROM course_study_area_links l
            JOIN study_areas sa ON sa.id=l.study_area_id
            JOIN study_programs sp ON sp.id=sa.program_id
            WHERE sp.code='BSC_INFO_2021' AND sa.code IN ('PRAK','TECH','THEO','INFO')
              AND l.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
            UNION ALL
            SELECT m.course_id
            FROM course_curriculum_matches m
            JOIN module_study_area_options opt ON opt.module_id=m.module_id
            JOIN study_areas sa ON sa.id=opt.study_area_id
            JOIN study_programs sp ON sp.id=sa.program_id
            WHERE sp.code='BSC_INFO_2021' AND sa.code IN ('PRAK','TECH','THEO','INFO')
              AND m.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
            UNION ALL
            SELECT l.course_id
            FROM course_study_area_links l
            JOIN study_areas sa ON sa.id=l.study_area_id
            JOIN study_programs sp ON sp.id=sa.program_id
            WHERE sp.code='MSC_INFO_2021'
              AND sa.code IN ('INFO-PRAK','INFO-TECH','INFO-THEO','INFO-INFO','INFO-FOKUS','INFO-BASIS')
              AND l.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
            UNION ALL
            SELECT m.course_id
            FROM course_curriculum_matches m
            JOIN module_study_area_options opt ON opt.module_id=m.module_id
            JOIN study_areas sa ON sa.id=opt.study_area_id
            JOIN study_programs sp ON sp.id=sa.program_id
            WHERE sp.code='MSC_INFO_2021'
              AND sa.code IN ('INFO-PRAK','INFO-TECH','INFO-THEO','INFO-INFO','INFO-FOKUS','INFO-BASIS')
              AND m.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
        )
        """,
        [json.dumps(course_ids)] * 4,
    )
    return {int(row['courseId']) for row in rows}


async def _load_catalog_categories(env: Any, course_ids: list[int]) -> dict[int, set[str]]:
    rows = await fetch_all(
        env,
        """
        SELECT m.course_id AS courseId, sa.code AS studyAreaCode
        FROM course_curriculum_matches AS m
        LEFT JOIN module_study_area_options AS opt ON opt.module_id = m.module_id
        LEFT JOIN study_areas AS sa ON sa.id = opt.study_area_id
        WHERE m.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
        UNION ALL
        SELECT l.course_id, sa.code
        FROM course_study_area_links AS l
        JOIN study_areas AS sa ON sa.id = l.study_area_id
        WHERE l.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
        """,
        [json.dumps(course_ids), json.dumps(course_ids)],
    )
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(int(row['courseId']), []).append(row)
    return {course_id: set(_normalize_master_cats(options)) for course_id, options in grouped.items()}


async def load_course_options_for_regulation(
    env: Any,
    regulation_version_id: int | None,
    course_ids: list[int],
    *,
    study_program_code: str | None = None,
    msc_info_basis_admission_confirmed: bool = False,
) -> dict[int, list[CourseOption]]:
    if regulation_version_id is None or not course_ids:
        return {}

    rows = await load_regulation_course_options(
        env,
        regulation_version_id,
        course_ids,
        allowed_only=True,
    )
    rule_groups = await load_regulation_rule_groups(env, regulation_version_id)
    catalog_categories = await _load_catalog_categories(env, course_ids)
    options_by_course_id: dict[int, list[CourseOption]] = {}
    ml_cs_eligible_ids = (
        await _load_ml_general_cs_eligible_course_ids(env, course_ids)
        if study_program_code == 'MSC_ML_2021' else set()
    )
    for course_id in dict.fromkeys(course_ids):
        options = rows.get(course_id, [])
        if study_program_code == 'MSC_INFO_2021':
            unavailable_area = 'INFO-FOKUS' if msc_info_basis_admission_confirmed else 'INFO-BASIS'
            options = [option for option in options
                       if option.get('studyAreaCode') != unavailable_area]
        if study_program_code == 'MSC_ML_2021':
            # ML categories are not interchangeable: generic BSc/master tags must
            # not auto-expand a course into Foundations, Diverse Topics, or EXP.
            options = [option for option in options if option.get('studyAreaCode') != 'ML-CS']
            if course_id in ml_cs_eligible_ids:
                options = [*options, {
                    'studyAreaCode': 'ML-CS', 'studyAreaName': rule_groups.get('ML-CS', {}).get('name'),
                    'groupType': rule_groups.get('ML-CS', {}).get('groupType'),
                    'sortOrder': rule_groups.get('ML-CS', {}).get('sortOrder'), 'ectsCounted': None,
                }]
            options_by_course_id[course_id] = [
                CourseOption(course_id, str(option['studyAreaCode']),
                             _safe_text(option.get('studyAreaName')) or str(option['studyAreaCode']),
                             _safe_text(option.get('groupType')) or 'study_area',
                             int(option.get('sortOrder') or 0),
                             _normalize_float(option.get('ectsCounted')) or 0.0)
                for option in options if option.get('studyAreaCode') in rule_groups
            ]
            continue
        if has_unresolved_assignment_evidence(options):
            continue
        if not compulsory_course_options(options):
            if course_id not in catalog_categories:
                continue
            # Match the UI's active-PO elective expansion before autosave. Manual
            # capacity is intentionally not checked: users can move a second
            # course out after moving the first into an already-full area.
            mapped_codes = {option['studyAreaCode'] for option in options}
            mapped_categories = {
                category for option in options
                if (category := study_area_code_to_master_cat(option['studyAreaCode'])) is not None
            }
            if options and not mapped_categories:
                mapped_categories = catalog_categories[course_id]
            options = [*options, *[
                {
                    'studyAreaCode': code, 'studyAreaName': group.get('name'),
                    'groupType': group.get('groupType'), 'sortOrder': group.get('sortOrder'),
                    'ectsCounted': None,
                }
                for code, group in rule_groups.items()
                if code not in mapped_codes
                and (study_program_code != 'MSC_INFO_2021'
                     or code != ('INFO-FOKUS' if msc_info_basis_admission_confirmed else 'INFO-BASIS'))
                and is_flexible_rule_group(code, group.get('name'), group.get('groupType'))
                and (code == 'UEBK' or not mapped_categories
                     or study_area_code_to_master_cat(code) in mapped_categories)
            ]]
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
    regulation_preferences = user['profile'].get('regulationPreferences') or {}
    course_options = await load_course_options_for_regulation(
        env, regulation_version_id, course_ids,
        study_program_code=_safe_text(user['profile'].get('studyProgramCode')),
        msc_info_basis_admission_confirmed=bool(regulation_preferences.get('mscInfoBasisAdmissionConfirmed')),
    )
    validated_assignments: dict[str, str] = {}

    study_program_code = _safe_text(user['profile'].get('studyProgramCode'))
    planned_courses = (
        await _load_planned_courses(env, course_ids, course_options, study_program_code)
        if study_program_code in {'MSC_INFO_2021', 'MSC_ML_2021'} else {}
    )
    completed_assessments = (
        await _load_completed_assessment_assignments(env, str(user['username']), study_program_code)
        if study_program_code in {'MSC_INFO_2021', 'MSC_ML_2021'} else []
    )
    for course_id_text, area_code in relevant_assignments.items():
        # Assignments are optional planner metadata. Catalog refreshes and
        # regulation changes can make a previously stored suggestion stale; in
        # that case keep the semester plan and simply drop the stale assignment.
        if area_code not in rule_groups:
            continue
        course_id = int(course_id_text)
        compatible_area_codes = {option.area_code for option in course_options.get(course_id, [])}
        if area_code not in compatible_area_codes:
            continue
        tentative = list(completed_assessments) + [
            {
                'areaCode': assigned_area,
                'ects': planned_courses[int(assigned_id)].ects,
                'assessmentType': assessment_type(
                    planned_courses[int(assigned_id)].course_type,
                    planned_courses[int(assigned_id)].title,
                ),
            }
            for assigned_id, assigned_area in validated_assignments.items()
            if int(assigned_id) in planned_courses
        ]
        if course_id in planned_courses:
            tentative.append({
                'areaCode': area_code, 'ects': planned_courses[course_id].ects,
                'assessmentType': assessment_type(planned_courses[course_id].course_type, planned_courses[course_id].title),
            })
        if assignment_limit_error(study_program_code, tentative):
            continue
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


async def _load_planned_courses(
    env: Any,
    course_ids: list[int],
    course_options: dict[int, list[CourseOption]],
    study_program_code: str | None,
) -> dict[int, PlannedCourse]:
    rows = await _fetch_catalog_courses_by_ids(env, course_ids)
    courses: dict[int, PlannedCourse] = {}
    for row in rows:
        course_id = int(row['id'])
        mapped_credits = {option.ects_counted for option in course_options.get(course_id, [])
                          if option.ects_counted > 0}
        tree_options = [option for option in get_tree_credit_options([row])
                        if not study_program_code or option['programCode'] == study_program_code]
        # Use the same published sources as the catalog, never an unrelated PO's
        # MAX or zero as an invented credit value for newly flexible targets.
        ects = (next(iter(mapped_credits)) if len(mapped_credits) == 1 else None)
        if ects is None:
            ects = _extract_ects_from_text(_safe_text(row.get('shortComment')))
        if ects is None:
            ects = get_unambiguous_tree_credits(tree_options)
        courses[course_id] = PlannedCourse(
            course_id, _safe_text(row.get('title')) or 'Untitled course',
            ects or 0.0, _safe_text(row.get('courseType')) or '',
        )
    return courses


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


async def _load_completed_assessment_assignments(
    env: Any, username: str, program_code: str | None,
) -> list[dict[str, Any]]:
    if program_code not in {'MSC_INFO_2021', 'MSC_ML_2021'}:
        return []
    stored = await load_user_progress_json(env, username, 'completed_courses_json')
    courses = [course for course in parse_json_array(stored) if isinstance(course, dict)]
    stable_codes = list(dict.fromkeys(
        code for course in courses
        if (code := _safe_text(course.get('courseNumber') or course.get('externalCourseCode')))
    ))
    catalog_types: dict[str, set[str]] = {}
    if stable_codes:
        rows = await fetch_all(
            env,
            """SELECT COALESCE(number, unit_id) AS stableCode, course_type AS courseType
               FROM courses
               WHERE COALESCE(number, unit_id) IN (SELECT value FROM json_each(?))""",
            [json.dumps(stable_codes)],
        )
        for row in rows:
            code = _safe_text(row.get('stableCode'))
            course_type = _safe_text(row.get('courseType'))
            if code and course_type:
                catalog_types.setdefault(code, set()).add(course_type)
    assignments: list[dict[str, Any]] = []
    seen_identities: set[str] = set()
    for course in courses:
        code = _safe_text(course.get('courseNumber') or course.get('externalCourseCode'))
        types = catalog_types.get(code or '', set())
        unique_type = next(iter(types)) if len(types) == 1 else None
        kind = assessment_type(unique_type, _safe_text(course.get('title')))
        if kind == 'other':
            continue
        identity = achievement_identity(course, program_code)
        if identity in seen_identities:
            continue
        seen_identities.add(identity)
        assignments.append({
            'areaCode': _normalize_study_area_code(course.get('studyAreaCode')),
            'ects': _normalize_float(course.get('ects')) or 0.0,
            'assessmentType': kind,
        })
    return assignments


async def _load_completed_ects_by_area(
    env: Any,
    username: str,
    rule_groups: dict[str, RuleGroup],
    regulation_version_id: int | None = None,
) -> tuple[dict[str, float], set[int]]:
    stored_value = await load_user_progress_json(env, username, 'completed_courses_json')
    completed_ects_by_area: dict[str, float] = {code: 0.0 for code in rule_groups}
    completed_course_ids: set[int] = set()

    completed_courses = await canonicalize_completed_courses(
        env, regulation_version_id,
        [course for course in parse_json_array(stored_value) if isinstance(course, dict)],
    )
    for raw_course in completed_courses:
        completed_course = _coerce_completed_course_record(raw_course)
        if completed_course is None:
            continue
        course_id, area_code, ects = completed_course
        if course_id is not None:
            completed_course_ids.add(course_id)
        if raw_course.get('assignmentNeedsReview') or area_code not in rule_groups:
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
) -> tuple[int, float, float, float, int, int, float]:
    assigned_count = len(assignments)
    remaining_capacity = 0.0
    fill_ratios: list[float] = []
    for area_code, rule_group in rule_groups.items():
        capacity = _effective_capacity(rule_group)
        if capacity is None:
            continue
        area_total = area_totals.get(area_code, 0.0)
        remaining_capacity += max(0.0, capacity - area_total)
        if capacity > 0:
            fill_ratios.append(max(0.0, area_total / capacity))

    max_fill_ratio = max(fill_ratios, default=0.0)
    mean_fill_ratio = sum(fill_ratios) / len(fill_ratios) if fill_ratios else 0.0
    fill_variance = sum((ratio - mean_fill_ratio) ** 2 for ratio in fill_ratios)
    filled_area_count = sum(1 for ratio in fill_ratios if ratio > 0.0001)
    kept_preferences = sum(
        1
        for course_id, area_code in assignments.items()
        if preferred_assignments.get(str(course_id)) == area_code
    )
    sort_penalty = sum(rule_groups[area_code].sort_order for area_code in assignments.values())
    return (
        assigned_count,
        -remaining_capacity,
        -max_fill_ratio,
        -fill_variance,
        filled_area_count,
        kept_preferences,
        -sort_penalty,
    )


def _balance_assignments(
    course_ids: list[int],
    planned_courses: dict[int, PlannedCourse],
    options_by_course_id: dict[int, list[CourseOption]],
    completed_ects_by_area: dict[str, float],
    completed_course_ids: set[int],
    rule_groups: dict[str, RuleGroup],
    preferred_assignments: dict[str, str],
    study_program_code: str | None = None,
    completed_assessments: list[dict[str, Any]] | None = None,
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
    best_score: tuple[int, float, float, float, int, int, float] | None = None
    policy_limit_failures: dict[int, str] = {}

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
            if ects <= 0:
                continue
            policy_assignments = list(completed_assessments or []) + [
                {
                    'areaCode': area_code,
                    'ects': planned_courses[assigned_id].ects,
                    'assessmentType': assessment_type(
                        planned_courses[assigned_id].course_type, planned_courses[assigned_id].title,
                    ),
                }
                for assigned_id, area_code in current_assignments.items()
            ]
            policy_assignments.append({
                'areaCode': option.area_code, 'ects': ects,
                'assessmentType': assessment_type(course.course_type, course.title),
            })
            policy_error = assignment_limit_error(study_program_code, policy_assignments)
            if policy_error:
                policy_limit_failures[course_id] = policy_error
                continue
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
            unknown_credits = planned_courses[course_id].ects <= 0 and all(
                option.ects_counted <= 0 for option in options_by_course_id.get(course_id, [])
            )
            limit_error = policy_limit_failures.get(course_id)
            warnings.append(
                {
                    'type': 'credit_policy_limit' if limit_error else
                            'unknown_credits' if unknown_credits else 'capacity_unassigned',
                    'reason': limit_error,
                    'courseId': str(course_id),
                    'courseTitle': planned_courses[course_id].title,
                    'message': ('This course would exceed an official seminar, practical, or research-project limit.'
                                if limit_error else
                                'Published ECTS are missing or ambiguous; choose an area manually.'
                                if unknown_credits else
                                'No compatible regulation area has enough remaining ECTS capacity.'),
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
    regulation_preferences = user['profile'].get('regulationPreferences') or {}
    options_by_course_id = await load_course_options_for_regulation(
        env,
        regulation_version_id,
        course_ids,
        study_program_code=_safe_text(user['profile'].get('studyProgramCode')),
        msc_info_basis_admission_confirmed=bool(regulation_preferences.get('mscInfoBasisAdmissionConfirmed')),
    )
    planned_courses = await _load_planned_courses(
        env, course_ids, options_by_course_id, _safe_text(user['profile'].get('studyProgramCode')),
    )
    completed_ects_by_area, completed_course_ids = await _load_completed_ects_by_area(
        env,
        username,
        rule_groups,
        regulation_version_id,
    )
    completed_assessments = await _load_completed_assessment_assignments(
        env, username, _safe_text(user['profile'].get('studyProgramCode')),
    )
    assignments, warnings, unassigned_course_ids, summary, strict_solution_found = _balance_assignments(
        course_ids,
        planned_courses,
        options_by_course_id,
        completed_ects_by_area,
        completed_course_ids,
        rule_groups,
        preferred_assignments,
        _safe_text(user['profile'].get('studyProgramCode')),
        completed_assessments,
    )
    return {
        'assignments': assignments,
        'warnings': warnings,
        'unassignedCourseIds': unassigned_course_ids,
        'summary': summary,
        'strictSolutionFound': strict_solution_found,
    }

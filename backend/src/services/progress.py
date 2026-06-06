from __future__ import annotations

from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.user_data import load_user_progress_json, parse_json_array

MASTER_CATEGORY_ORDER = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']


def _rule_group_code_to_master_cat(code: str | None) -> str | None:
    """Mirror of _study_area_to_master_cat in course_catalog.py."""
    if not code:
        return None
    normalized = code.upper()
    if normalized.endswith('TECH'):
        return 'TECH'
    if normalized.endswith('THEO'):
        return 'THEO'
    if normalized.endswith('PRAK'):
        return 'PRAK'
    if normalized in {'INFO', 'INFO-INFO', 'ML-CS'} or normalized.endswith('-INFO'):
        return 'INFO'
    if normalized in {'INFO-FOKUS', 'ML-DIVERSE', 'ML-EXP', 'PROSEM', 'UEBK'}:
        return 'BASIS'
    if normalized in {'MATH', 'INF', 'INFO-BASIS', 'ML-FOUND'} or normalized.endswith('BASIS'):
        return 'BASIS'
    return None


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_master_cat(value: Any) -> str | None:
    normalized_value = _safe_text(value)
    if normalized_value == 'FOKUS':
        return 'BASIS'
    return normalized_value


def _coerce_unix(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _normalize_study_area_code(value: Any) -> str | None:
    normalized_value = _safe_text(value)
    return normalized_value.upper() if normalized_value else None


def _match_regulation(
    mapping_regulation_version_id: int | None,
    active_regulation_version_id: int | None,
) -> bool:
    return mapping_regulation_version_id is None or mapping_regulation_version_id == active_regulation_version_id


def _grade_quality_multiplier(grade: float | None) -> float:
    """Map grade (1.0 best ... 4.0 worst) to a small quality multiplier.

    Better grades should matter, but only as a light tilt on top of the ECTS weight.
    """
    if grade is None:
        return 1.0
    clamped_grade = max(1.0, min(4.0, grade))
    return max(0.85, 1.05 - (clamped_grade - 1.0) * 0.06)


def _build_completed_course_detail(completed_course: dict[str, Any]) -> dict[str, Any]:
    completed_course_id = str(completed_course['id'])
    direct_course_id = (
        int(completed_course['courseId']) if completed_course.get('courseId') is not None else None
    )
    course_number = _safe_text(completed_course.get('courseNumber'))
    external_course_code = _safe_text(completed_course.get('externalCourseCode'))
    return {
        'completedCourseId': completed_course_id,
        'courseId': str(direct_course_id) if direct_course_id is not None else None,
        'courseNumber': course_number or external_course_code,
        'title': _safe_text(completed_course.get('title')) or 'Untitled course',
        'ects': _normalize_float(completed_course.get('ects')) or 0.0,
        'grade': _normalize_float(completed_course.get('grade')),
        'semester': completed_course.get('semester'),
        'masterCat': completed_course.get('masterCat'),
        'studyAreaCode': _normalize_study_area_code(completed_course.get('studyAreaCode')),
    }


def _build_visualization_profile_name(
    visualization_categories: list[dict[str, Any]],
) -> str:
    non_zero_categories = [category for category in visualization_categories if category['earnedEcts'] > 0]
    if not non_zero_categories:
        return 'No profile yet'

    strong_categories = [
        category for category in non_zero_categories if category['progressRatio'] >= 0.25
    ]
    if len(strong_categories) >= 4:
        return 'Balanced'

    return max(
        non_zero_categories,
        key=lambda category: (category['progressRatio'], category['earnedEcts']),
    )['name']


def _append_progress_course(area_entry: dict[str, Any], completed_course: dict[str, Any]) -> None:
    area_entry['courses'].append(_build_completed_course_detail(completed_course))


def _finalize_regulation_area(area_entry: dict[str, Any]) -> dict[str, Any]:
    required_ects = _normalize_float(area_entry.get('requiredEcts')) or 0.0
    earned_ects = round(_normalize_float(area_entry.get('earnedEcts')) or 0.0, 2)
    courses = list(area_entry.get('courses') or [])
    return {
        'code': _safe_text(area_entry.get('code')) or '',
        'name': _safe_text(area_entry.get('name')) or '',
        'requiredEcts': required_ects,
        'earnedEcts': earned_ects,
        'masterCat': area_entry.get('masterCat'),
        'rawAreaCodes': [str(code) for code in area_entry.get('rawAreaCodes') or []],
        'courseCount': len(courses),
        'isFulfilled': earned_ects >= required_ects if required_ects > 0 else earned_ects > 0,
        'courses': courses,
    }


async def _load_course_numbers_by_id(env: Any, course_ids: list[int]) -> dict[int, str]:
    if not course_ids:
        return {}
    unique_course_ids = sorted(set(course_ids))
    placeholders = ', '.join('?' for _ in unique_course_ids)
    rows = await fetch_all(
        env,
        f'SELECT id, number FROM courses WHERE id IN ({placeholders})',
        unique_course_ids,
    )
    return {
        int(row['id']): str(row['number'])
        for row in rows
        if row.get('number') is not None
    }


def _coerce_completed_course_for_progress(raw_course: Any, fallback_id: str) -> dict[str, Any] | None:
    if not isinstance(raw_course, dict):
        return None
    title = _safe_text(raw_course.get('title'))
    semester = _safe_text(raw_course.get('semester'))
    if not title or not semester:
        return None

    course_id: int | None = None
    raw_course_id = raw_course.get('courseId')
    if raw_course_id not in {None, ''}:
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError):
            course_id = None

    grade = _normalize_float(raw_course.get('grade')) if raw_course.get('grade') not in {None, ''} else None
    return {
        'id': _safe_text(raw_course.get('id')) or fallback_id,
        'courseId': course_id,
        'courseNumber': None,
        'externalCourseCode': _safe_text(raw_course.get('externalCourseCode')),
        'title': title,
        'ects': _normalize_float(raw_course.get('ects')) or 0.0,
        'masterCat': _normalize_master_cat(raw_course.get('masterCat')),
        'studyAreaCode': _normalize_study_area_code(raw_course.get('studyAreaCode')),
        'grade': grade,
        'semester': semester,
        'createdAtUnix': _coerce_unix(raw_course.get('createdAtUnix')),
    }


async def _load_completed_courses_for_progress(env: Any, username: str) -> list[dict[str, Any]]:
    stored_value = await load_user_progress_json(env, username, 'completed_courses_json')
    completed_courses = [
        completed_course
        for index, raw_course in enumerate(parse_json_array(stored_value))
        if (completed_course := _coerce_completed_course_for_progress(raw_course, str(index + 1))) is not None
    ]
    course_ids = [int(course['courseId']) for course in completed_courses if course.get('courseId') is not None]
    course_numbers = await _load_course_numbers_by_id(env, course_ids)
    for completed_course in completed_courses:
        course_id = int(completed_course['courseId']) if completed_course.get('courseId') is not None else None
        completed_course['courseNumber'] = course_numbers.get(course_id) if course_id is not None else None
    completed_courses.sort(key=lambda course: (course.get('createdAtUnix') or 0, str(course.get('id') or '')))
    return completed_courses


def _group_bachelor_dashboard_areas(raw_areas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    math_area = next((area for area in raw_areas if area.get('code') == 'MATH'), None)
    inf_area = next((area for area in raw_areas if area.get('code') == 'INF'), None)
    if math_area is None or inf_area is None:
        return [_finalize_regulation_area(area) for area in raw_areas]

    grouped_areas: list[dict[str, Any]] = []
    merged_inf = {
        **inf_area,
        'requiredEcts': (_normalize_float(inf_area.get('requiredEcts')) or 0.0)
        + (_normalize_float(math_area.get('requiredEcts')) or 0.0),
        'earnedEcts': (_normalize_float(inf_area.get('earnedEcts')) or 0.0)
        + (_normalize_float(math_area.get('earnedEcts')) or 0.0),
        'rawAreaCodes': [
            *list(dict.fromkeys(['INF', 'MATH', *(inf_area.get('rawAreaCodes') or []), *(math_area.get('rawAreaCodes') or [])])),
        ],
        'courses': [*(inf_area.get('courses') or []), *(math_area.get('courses') or [])],
    }

    inserted_merged_inf = False
    for area in raw_areas:
        code = _safe_text(area.get('code')) or ''
        if code == 'MATH':
            continue
        if code == 'INF':
            grouped_areas.append(_finalize_regulation_area(merged_inf))
            inserted_merged_inf = True
            continue
        grouped_areas.append(_finalize_regulation_area(area))

    if not inserted_merged_inf:
        grouped_areas.insert(0, _finalize_regulation_area(merged_inf))
    return grouped_areas


async def _build_regulation_progress(
    env: Any,
    active_regulation_version_id: int | None,
    study_program_code: str | None,
    completed_courses: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if active_regulation_version_id is None:
        return []

    rule_groups = await fetch_all(
        env,
        """
        SELECT id, code, name, required_ects AS requiredEcts, sort_order AS sortOrder
        FROM regulation_rule_groups
        WHERE regulation_version_id = ?
        ORDER BY sort_order ASC, code ASC
        """,
        [active_regulation_version_id],
    )
    if not rule_groups:
        return []

    raw_progress_by_group_id: dict[int, dict[str, Any]] = {}
    for rule_group in rule_groups:
        rule_group_id = int(rule_group['id'])
        code = _safe_text(rule_group.get('code')) or ''
        raw_progress_by_group_id[rule_group_id] = {
            'id': rule_group_id,
            'code': code,
            'name': _safe_text(rule_group.get('name')) or code,
            'requiredEcts': _normalize_float(rule_group.get('requiredEcts')) or 0.0,
            'earnedEcts': 0.0,
            'masterCat': _rule_group_code_to_master_cat(code),
            'sortOrder': int(rule_group.get('sortOrder') or 0),
            'rawAreaCodes': [code],
            'courses': [],
        }

    completed_course_ids = [
        int(completed_course['courseId'])
        for completed_course in completed_courses
        if completed_course.get('courseId') is not None
    ]
    primary_rule_group_by_course_id: dict[int, int] = {}

    if completed_course_ids:
        placeholders = ', '.join('?' for _ in completed_course_ids)
        course_mappings = await fetch_all(
            env,
            f"""
            SELECT
                rcm.course_id AS courseId,
                rcm.rule_group_id AS ruleGroupId,
                rrg.code AS ruleGroupCode,
                rrg.sort_order AS sortOrder
            FROM regulation_course_mappings AS rcm
            JOIN regulation_rule_groups AS rrg ON rrg.id = rcm.rule_group_id
            WHERE rcm.regulation_version_id = ?
              AND rcm.course_id IN ({placeholders})
            ORDER BY rcm.course_id ASC, rrg.sort_order ASC, rrg.code ASC
            """,
            [active_regulation_version_id, *completed_course_ids],
        )
        for mapping in course_mappings:
            course_id = int(mapping['courseId'])
            primary_rule_group_by_course_id.setdefault(course_id, int(mapping['ruleGroupId']))

    for completed_course in completed_courses:
        course_id = int(completed_course['courseId']) if completed_course.get('courseId') is not None else None
        earned_ects = _normalize_float(completed_course.get('ects')) or 0.0
        explicit_study_area_code = _normalize_study_area_code(completed_course.get('studyAreaCode'))
        rule_group_id: int | None = None

        if explicit_study_area_code is not None:
            matching_rule_group_ids = [
                group_id
                for group_id, area_entry in raw_progress_by_group_id.items()
                if area_entry['code'] == explicit_study_area_code
            ]
            if matching_rule_group_ids:
                rule_group_id = matching_rule_group_ids[0]

        if rule_group_id is None and course_id is not None:
            rule_group_id = primary_rule_group_by_course_id.get(course_id)

        if rule_group_id is None:
            master_cat = _normalize_master_cat(completed_course.get('masterCat'))
            matching_rule_group_ids = [
                group_id
                for group_id, area_entry in raw_progress_by_group_id.items()
                if area_entry['masterCat'] == master_cat
            ]
            if len(matching_rule_group_ids) == 1:
                rule_group_id = matching_rule_group_ids[0]

        if rule_group_id is None:
            continue

        area_entry = raw_progress_by_group_id.get(rule_group_id)
        if area_entry is None:
            continue
        area_entry['earnedEcts'] += earned_ects
        _append_progress_course(area_entry, completed_course)

    ordered_raw_areas = [raw_progress_by_group_id[int(rule_group['id'])] for rule_group in rule_groups]
    if study_program_code and study_program_code.startswith('BSC_'):
        return _group_bachelor_dashboard_areas(ordered_raw_areas)
    return [_finalize_regulation_area(area) for area in ordered_raw_areas]


async def get_current_user_progress(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])
    active_regulation_version_id = user['profile'].get('regulationVersionId')
    study_program_code = _safe_text(user['profile'].get('studyProgramCode'))
    required_ects = _normalize_float(user['profile'].get('totalEcts'))
    if required_ects is None:
        required_ects = 120.0

    completed_courses = await _load_completed_courses_for_progress(env, username)

    progress_categories = await fetch_all(
        env,
        """
        SELECT
            id,
            code,
            name,
            description,
            reference_ects AS referenceEcts,
            color_token AS colorToken,
            sort_order AS sortOrder
        FROM progress_categories
        ORDER BY sort_order ASC, name ASC
        """,
    )

    category_mappings = await fetch_all(
        env,
        """
        SELECT
            m.progress_category_id AS progressCategoryId,
            m.course_id AS courseId,
            m.regulation_version_id AS regulationVersionId,
            m.weight,
            c.number AS courseNumber,
            c.title AS courseTitle
        FROM course_progress_category_mappings AS m
        JOIN courses AS c ON c.id = m.course_id
        """,
    )

    for completed_course in completed_courses:
        completed_course['masterCat'] = _normalize_master_cat(completed_course.get('masterCat'))

    total_ects = sum(_normalize_float(course.get('ects')) or 0 for course in completed_courses)
    graded_courses = [
        _normalize_float(course.get('grade'))
        for course in completed_courses
        if _normalize_float(course.get('grade')) is not None
        and _normalize_study_area_code(course.get('studyAreaCode')) != 'UEBK'
    ]
    average_grade = sum(graded_courses) / len(graded_courses) if graded_courses else None
    progress_percentage = round((total_ects / required_ects) * 100) if required_ects > 0 else 0

    master_category_progress = []
    for master_category in MASTER_CATEGORY_ORDER:
        earned_ects = sum(
            (_normalize_float(course.get('ects')) or 0)
            for course in completed_courses
            if course.get('masterCat') == master_category
        )
        master_category_progress.append(
            {
                'cat': master_category,
                'earnedEcts': earned_ects,
            }
        )

    progress_by_category_id: dict[int, dict[str, Any]] = {
        int(category['id']): {
            'code': category['code'],
            'name': category['name'],
            'description': category.get('description'),
            'referenceEcts': _normalize_float(category.get('referenceEcts')) or 0.0,
            'colorToken': category.get('colorToken'),
            'sortOrder': int(category.get('sortOrder') or 0),
            'earnedEcts': 0.0,
            'qualityScore': 0.0,
            'courses': [],
        }
        for category in progress_categories
    }

    used_category_assignments: set[tuple[str, int]] = set()
    unmapped_completed_courses: list[dict[str, Any]] = []

    for completed_course in completed_courses:
        completed_course_id = str(completed_course['id'])
        direct_course_id = (
            int(completed_course['courseId']) if completed_course.get('courseId') is not None else None
        )
        external_course_code = _safe_text(completed_course.get('externalCourseCode'))
        course_number = _safe_text(completed_course.get('courseNumber'))
        title = _safe_text(completed_course.get('title'))
        normalized_title = title.lower() if title else None
        matched_category_ids: set[int] = set()

        for mapping in category_mappings:
            mapping_category_id = int(mapping['progressCategoryId'])
            mapping_regulation_version_id = (
                int(mapping['regulationVersionId'])
                if mapping.get('regulationVersionId') is not None
                else None
            )
            if not _match_regulation(mapping_regulation_version_id, active_regulation_version_id):
                continue

            mapping_course_id = int(mapping['courseId'])
            mapping_course_number = _safe_text(mapping.get('courseNumber'))
            mapping_title = _safe_text(mapping.get('courseTitle'))
            normalized_mapping_title = mapping_title.lower() if mapping_title else None

            is_match = False
            if direct_course_id is not None and mapping_course_id == direct_course_id:
                is_match = True
            elif external_course_code and mapping_course_number and mapping_course_number == external_course_code:
                is_match = True
            elif course_number and mapping_course_number and mapping_course_number == course_number:
                is_match = True
            elif normalized_title and normalized_mapping_title and normalized_mapping_title == normalized_title:
                is_match = True

            if not is_match:
                continue

            assignment_key = (completed_course_id, mapping_category_id)
            if assignment_key in used_category_assignments:
                continue
            used_category_assignments.add(assignment_key)
            matched_category_ids.add(mapping_category_id)

            category_entry = progress_by_category_id[mapping_category_id]
            weight = _normalize_float(mapping.get('weight')) or 1.0
            ects_value = (_normalize_float(completed_course.get('ects')) or 0.0) * weight
            grade_multiplier = _grade_quality_multiplier(_normalize_float(completed_course.get('grade')))
            reference_ects = category_entry['referenceEcts']
            single_course_cap = (reference_ects * 0.3) if reference_ects > 0 else ects_value
            capped_ects = min(ects_value, single_course_cap)
            category_entry['earnedEcts'] += ects_value
            category_entry['qualityScore'] += capped_ects * grade_multiplier
            category_entry['courses'].append(_build_completed_course_detail(completed_course))

        if not matched_category_ids:
            unmapped_completed_courses.append(_build_completed_course_detail(completed_course))

    visualization_categories = []
    for category in progress_by_category_id.values():
        reference_ects = category['referenceEcts']
        earned_ects = round(category['earnedEcts'], 2)
        quality_score = round(category['qualityScore'], 2)
        progress_ratio = 0.0 if reference_ects <= 0 else min(1.0, quality_score / reference_ects)
        visualization_categories.append(
            {
                **category,
                'earnedEcts': earned_ects,
                'qualityScore': quality_score,
                'progressRatio': progress_ratio,
                'progressPercentage': round(progress_ratio * 100),
            }
        )

    profile_name = _build_visualization_profile_name(visualization_categories)
    regulation_progress = await _build_regulation_progress(
        env,
        active_regulation_version_id,
        study_program_code,
        completed_courses,
    )

    return {
        'summary': {
            'totalEcts': total_ects,
            'requiredEcts': required_ects,
            'progressPercentage': progress_percentage,
            'averageGrade': average_grade,
        },
        'masterCategoryProgress': master_category_progress,
        'regulationProgress': regulation_progress,
        'visualizationCategories': visualization_categories,
        'profileName': profile_name,
        'unmappedCompletedCourses': unmapped_completed_courses,
    }

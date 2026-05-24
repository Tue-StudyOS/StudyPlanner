from __future__ import annotations

from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user

MASTER_CATEGORY_ORDER = ['TECH', 'THEO', 'PRAK', 'INFO', 'FOKUS', 'BASIS']


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


def _match_regulation(mapping_regulation_version_id: int | None, active_regulation_version_id: int | None) -> bool:
    return mapping_regulation_version_id is None or mapping_regulation_version_id == active_regulation_version_id


async def get_current_user_progress(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    user_id = int(user['id'])
    active_regulation_version_id = user['profile'].get('regulationVersionId')
    required_ects = _normalize_float(user['profile'].get('totalEcts'))
    if required_ects is None:
        required_ects = 120.0

    completed_courses = await fetch_all(
        env,
        """
        SELECT
            ucc.id,
            ucc.course_id AS courseId,
            c.number AS courseNumber,
            ucc.external_course_code AS externalCourseCode,
            ucc.title,
            ucc.ects,
            ucc.master_cat AS masterCat,
            ucc.grade,
            ucc.semester
        FROM user_completed_courses AS ucc
        LEFT JOIN courses AS c ON c.id = ucc.course_id
        WHERE ucc.user_id = ?
        ORDER BY ucc.created_at_unix ASC, ucc.id ASC
        """,
        [user_id],
    )

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

    total_ects = sum(_normalize_float(course.get('ects')) or 0 for course in completed_courses)
    graded_courses = [
        _normalize_float(course.get('grade'))
        for course in completed_courses
        if _normalize_float(course.get('grade')) is not None
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
            'courses': [],
        }
        for category in progress_categories
    }

    used_category_assignments: set[tuple[int, int]] = set()
    unmapped_completed_courses: list[dict[str, Any]] = []

    for completed_course in completed_courses:
        completed_course_id = int(completed_course['id'])
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
            earned_ects = (_normalize_float(completed_course.get('ects')) or 0.0) * weight
            category_entry['earnedEcts'] += earned_ects
            category_entry['courses'].append(
                {
                    'completedCourseId': str(completed_course_id),
                    'courseId': str(direct_course_id) if direct_course_id is not None else None,
                    'courseNumber': course_number or external_course_code,
                    'title': title or 'Untitled course',
                    'ects': _normalize_float(completed_course.get('ects')) or 0.0,
                    'semester': completed_course.get('semester'),
                    'masterCat': completed_course.get('masterCat'),
                }
            )

        if not matched_category_ids:
            unmapped_completed_courses.append(
                {
                    'completedCourseId': str(completed_course_id),
                    'courseId': str(direct_course_id) if direct_course_id is not None else None,
                    'courseNumber': course_number or external_course_code,
                    'title': title or 'Untitled course',
                    'ects': _normalize_float(completed_course.get('ects')) or 0.0,
                    'semester': completed_course.get('semester'),
                    'masterCat': completed_course.get('masterCat'),
                }
            )

    visualization_categories = []
    for category in progress_by_category_id.values():
        reference_ects = category['referenceEcts']
        earned_ects = round(category['earnedEcts'], 2)
        progress_ratio = 0.0 if reference_ects <= 0 else min(1.0, earned_ects / reference_ects)
        visualization_categories.append(
            {
                **category,
                'earnedEcts': earned_ects,
                'progressRatio': progress_ratio,
                'progressPercentage': round(progress_ratio * 100),
            }
        )

    non_zero_categories = [category for category in visualization_categories if category['earnedEcts'] > 0]
    profile_name = 'No profile yet'
    if non_zero_categories:
        strong_categories = [
            category for category in non_zero_categories if category['progressRatio'] >= 0.25
        ]
        if len(strong_categories) >= 4:
            profile_name = 'Balanced'
        else:
            profile_name = max(
                non_zero_categories,
                key=lambda category: (category['progressRatio'], category['earnedEcts']),
            )['name']

    return {
        'summary': {
            'totalEcts': total_ects,
            'requiredEcts': required_ects,
            'progressPercentage': progress_percentage,
            'averageGrade': average_grade,
        },
        'masterCategoryProgress': master_category_progress,
        'visualizationCategories': visualization_categories,
        'profileName': profile_name,
        'unmappedCompletedCourses': unmapped_completed_courses,
    }

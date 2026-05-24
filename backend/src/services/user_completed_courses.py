from __future__ import annotations

import time
from typing import Any

from db.d1 import execute, fetch_all
from services.authentication import require_authenticated_user

ALLOWED_MASTER_CATEGORIES = {'TECH', 'THEO', 'PRAK', 'INFO', 'FOKUS', 'BASIS'}


class CompletedCourseUpdateError(ValueError):
    """Raised when completed-course persistence input is invalid."""


class CompletedCoursePayload(dict[str, Any]):
    pass


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_float(value: Any, *, field_name: str) -> float:
    try:
        normalized_value = float(value)
    except (TypeError, ValueError) as exc:
        raise CompletedCourseUpdateError(f'{field_name} must be numeric.') from exc
    return normalized_value


def _now_unix() -> int:
    return int(time.time())


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
        raise CompletedCourseUpdateError(
            'Unknown course ids in completed-course payload: '
            + ', '.join(str(course_id) for course_id in missing_ids)
        )


async def _serialize_completed_courses(env: Any, user_id: int) -> list[dict[str, Any]]:
    rows = await fetch_all(
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
            ucc.semester,
            ucc.source
        FROM user_completed_courses AS ucc
        LEFT JOIN courses AS c ON c.id = ucc.course_id
        WHERE ucc.user_id = ?
        ORDER BY ucc.semester DESC, ucc.created_at_unix DESC, ucc.id ASC
        """,
        [user_id],
    )

    return [
        {
            'id': str(int(row['id'])),
            'courseId': str(int(row['courseId'])) if row.get('courseId') is not None else None,
            'courseNumber': _safe_text(row.get('courseNumber')),
            'externalCourseCode': _safe_text(row.get('externalCourseCode')),
            'title': row['title'],
            'ects': float(row['ects']),
            'masterCat': row['masterCat'],
            'grade': float(row['grade']) if row.get('grade') is not None else None,
            'semester': row['semester'],
            'source': row['source'],
        }
        for row in rows
    ]


def _normalize_completed_course(payload: Any) -> CompletedCoursePayload:
    if not isinstance(payload, dict):
        raise CompletedCourseUpdateError('Each completed course must be a JSON object.')

    title = _safe_text(payload.get('title'))
    if not title:
        raise CompletedCourseUpdateError('Each completed course requires a title.')

    semester = _safe_text(payload.get('semester'))
    if not semester:
        raise CompletedCourseUpdateError('Each completed course requires a semester label.')

    master_cat = _safe_text(payload.get('masterCat'))
    if master_cat not in ALLOWED_MASTER_CATEGORIES:
        raise CompletedCourseUpdateError('Each completed course requires a valid masterCat value.')

    course_id: int | None = None
    raw_course_id = payload.get('courseId')
    if raw_course_id not in {None, ''}:
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError) as exc:
            raise CompletedCourseUpdateError('courseId values must be numeric.') from exc

    grade: float | None = None
    raw_grade = payload.get('grade')
    if raw_grade not in {None, ''}:
        grade = _normalize_float(raw_grade, field_name='grade')

    return CompletedCoursePayload(
        courseId=course_id,
        externalCourseCode=_safe_text(payload.get('externalCourseCode')),
        title=title,
        ects=_normalize_float(payload.get('ects'), field_name='ects'),
        masterCat=master_cat,
        grade=grade,
        semester=semester,
        source=_safe_text(payload.get('source')) or 'manual',
    )


async def get_current_user_completed_courses(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    completed_courses = await _serialize_completed_courses(env, int(user['id']))
    return {
        'completedCourses': completed_courses,
        'count': len(completed_courses),
    }


async def replace_current_user_completed_courses(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    user_id = int(user['id'])

    raw_completed_courses = payload.get('completedCourses')
    if raw_completed_courses is None:
        raise CompletedCourseUpdateError('A completedCourses array is required.')
    if not isinstance(raw_completed_courses, list):
        raise CompletedCourseUpdateError('completedCourses must be an array.')

    completed_courses = [_normalize_completed_course(item) for item in raw_completed_courses]
    course_ids = [course['courseId'] for course in completed_courses if course['courseId'] is not None]
    await _validate_course_ids(env, [int(course_id) for course_id in course_ids])

    await execute(env, 'DELETE FROM user_completed_courses WHERE user_id = ?', [user_id])
    now_unix = _now_unix()
    for course in completed_courses:
        await execute(
            env,
            """
            INSERT INTO user_completed_courses (
                user_id,
                course_id,
                external_course_code,
                title,
                ects,
                master_cat,
                grade,
                semester,
                source,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                user_id,
                course['courseId'],
                course['externalCourseCode'],
                course['title'],
                course['ects'],
                course['masterCat'],
                course['grade'],
                course['semester'],
                course['source'],
                now_unix,
                now_unix,
            ],
        )

    saved_completed_courses = await _serialize_completed_courses(env, user_id)
    return {
        'completedCourses': saved_completed_courses,
        'count': len(saved_completed_courses),
    }

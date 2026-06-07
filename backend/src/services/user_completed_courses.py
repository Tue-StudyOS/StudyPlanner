from __future__ import annotations

import secrets
from typing import Any

from db.d1 import fetch_all
from services.authentication import require_authenticated_user
from services.regulation_assignment_options import (
    load_regulation_course_options as _load_course_rule_group_options,
    load_regulation_rule_groups as _load_rule_groups_for_regulation,
    normalize_study_area_code as _normalize_study_area_code,
)
from services.user_data import (
    load_user_progress_json,
    now_unix as _now_unix,
    parse_json_array,
    update_user_progress_json,
)

ALLOWED_MASTER_CATEGORIES = {'TECH', 'THEO', 'PRAK', 'INFO', 'BASIS'}
ALLOWED_GRADE_VALUES = (1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0)
LEGACY_MASTER_CATEGORY_ALIASES = {'FOKUS': 'BASIS'}


class CompletedCourseUpdateError(ValueError):
    """Raised when completed-course persistence input is invalid."""


class CompletedCoursePayload(dict[str, Any]):
    pass


class StoredCompletedCourse(dict[str, Any]):
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


def _optional_float(value: Any) -> float | None:
    if value in {None, ''}:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_unix(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _normalize_master_cat(value: Any) -> str | None:
    normalized_value = _safe_text(value)
    if normalized_value is None:
        return None
    return LEGACY_MASTER_CATEGORY_ALIASES.get(normalized_value, normalized_value)


def _normalize_grade(value: Any) -> float:
    grade = _normalize_float(value, field_name='grade')
    for allowed_grade in ALLOWED_GRADE_VALUES:
        if abs(grade - allowed_grade) < 0.0001:
            return allowed_grade
    raise CompletedCourseUpdateError(
        'grade must use the official ToR scale: 1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, or 4.0.'
    )


def _rule_group_code_to_master_cat(code: str | None) -> str | None:
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
    if normalized in {'ELECTIVE', 'INFO-FOKUS', 'ML-DIVERSE', 'ML-EXP', 'PROSEM', 'UEBK'}:
        return 'BASIS'
    if normalized in {'MATH', 'INF', 'INFO-BASIS', 'ML-FOUND'} or normalized.endswith('BASIS'):
        return 'BASIS'
    return None


def _is_flexible_rule_group(code: str, name: str | None, group_type: str | None) -> bool:
    normalized_code = code.upper()
    normalized_name = (name or '').strip().lower()
    normalized_group_type = (group_type or '').strip().lower()

    if normalized_code == 'THESIS':
        return False
    if normalized_code == 'UEBK':
        return True
    if normalized_group_type in {'elective_area', 'structured_elective'}:
        return True
    if normalized_code in {
        'PRAK',
        'TECH',
        'THEO',
        'INFO',
        'ELECTIVE',
        'INFO-PRAK',
        'INFO-TECH',
        'INFO-THEO',
        'INFO-INFO',
        'INFO-FOKUS',
        'INFO-BASIS',
        'ML-FOUND',
        'ML-DIVERSE',
        'ML-CS',
        'ML-EXP',
    }:
        return True
    return any(
        keyword in normalized_name
        for keyword in ('wahl', 'elective', 'fokus', 'basis', 'diverse', 'expanded')
    )


def _normalize_completed_course(payload: Any) -> CompletedCoursePayload:
    if not isinstance(payload, dict):
        raise CompletedCourseUpdateError('Each completed course must be a JSON object.')

    title = _safe_text(payload.get('title'))
    if not title:
        raise CompletedCourseUpdateError('Each completed course requires a title.')

    semester = _safe_text(payload.get('semester'))
    if not semester:
        raise CompletedCourseUpdateError('Each completed course requires a semester label.')

    master_cat = _normalize_master_cat(payload.get('masterCat'))
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
        grade = _normalize_grade(raw_grade)

    return CompletedCoursePayload(
        id=_safe_text(payload.get('id')),
        courseId=course_id,
        externalCourseCode=_safe_text(payload.get('externalCourseCode')),
        title=title,
        ects=_normalize_float(payload.get('ects'), field_name='ects'),
        masterCat=master_cat,
        studyAreaCode=_normalize_study_area_code(payload.get('studyAreaCode')),
        grade=grade,
        semester=semester,
        source=_safe_text(payload.get('source')) or 'manual',
    )


def _normalize_completed_course_key(course: dict[str, Any]) -> str:
    course_id = course.get('courseId')
    if course_id not in {None, ''}:
        return f'course:{int(course_id)}'

    title = _safe_text(course.get('title')) or ''
    semester = _safe_text(course.get('semester')) or ''
    ects = float(course.get('ects') or 0)
    grade = course.get('grade')
    return ':'.join(
        [
            'manual',
            title.lower(),
            semester.lower(),
            str(ects),
            'no-grade' if grade is None else str(float(grade)),
        ]
    )


def _build_assignable_options(
    course: CompletedCoursePayload,
    mapped_options: list[dict[str, Any]],
    rule_groups_by_code: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    assignable_by_code: dict[str, dict[str, Any]] = {}

    for option in mapped_options:
        study_area_code = _normalize_study_area_code(option.get('studyAreaCode'))
        if not study_area_code:
            continue
        assignable_by_code.setdefault(study_area_code, option)

    preferred_master_cats = {
        master_cat
        for master_cat in [
            *[_rule_group_code_to_master_cat(option.get('studyAreaCode')) for option in mapped_options],
            _normalize_master_cat(course.get('masterCat')),
        ]
        if master_cat is not None
    }

    for code, rule_group in rule_groups_by_code.items():
        if code in assignable_by_code:
            continue
        if not _is_flexible_rule_group(
            code,
            _safe_text(rule_group.get('name')),
            _safe_text(rule_group.get('groupType')),
        ):
            continue
        if preferred_master_cats and _rule_group_code_to_master_cat(code) not in preferred_master_cats:
            continue
        assignable_by_code[code] = {
            'studyAreaCode': code,
            'studyAreaName': _safe_text(rule_group.get('name')),
            'groupType': _safe_text(rule_group.get('groupType')),
        }

    return list(assignable_by_code.values())


def _resolve_assignment(
    course: CompletedCoursePayload,
    mapped_options: list[dict[str, Any]],
    rule_groups_by_code: dict[str, dict[str, Any]],
) -> tuple[str | None, str, bool, list[dict[str, Any]]]:
    selected_study_area_code = _normalize_study_area_code(course.get('studyAreaCode'))
    assignable_options = _build_assignable_options(course, mapped_options, rule_groups_by_code)
    assignable_codes = [option['studyAreaCode'] for option in assignable_options if option.get('studyAreaCode')]
    unique_assignable_codes = list(dict.fromkeys(assignable_codes))

    if unique_assignable_codes:
        if len(unique_assignable_codes) == 1:
            resolved_code = unique_assignable_codes[0]
        else:
            if not selected_study_area_code or selected_study_area_code not in unique_assignable_codes:
                raise CompletedCourseUpdateError(
                    'This course can count toward multiple regulation areas. Choose the correct regulation area before saving.'
                )
            resolved_code = selected_study_area_code

        resolved_master_cat = _rule_group_code_to_master_cat(resolved_code) or str(course['masterCat'])
        return resolved_code, resolved_master_cat, len(unique_assignable_codes) == 1, assignable_options

    if selected_study_area_code:
        rule_group = rule_groups_by_code.get(selected_study_area_code)
        if rule_group is None:
            raise CompletedCourseUpdateError(
                'The selected regulation area is not part of your active examination regulation.'
            )
        if not _is_flexible_rule_group(
            selected_study_area_code,
            _safe_text(rule_group.get('name')),
            _safe_text(rule_group.get('groupType')),
        ):
            raise CompletedCourseUpdateError(
                'Manual external courses can only be saved in flexible elective areas or ÜBK.'
            )
        resolved_master_cat = (
            _rule_group_code_to_master_cat(selected_study_area_code) or str(course['masterCat'])
        )
        return selected_study_area_code, resolved_master_cat, False, [
            {
                'studyAreaCode': selected_study_area_code,
                'studyAreaName': _safe_text(rule_group.get('name')),
                'groupType': _safe_text(rule_group.get('groupType')),
            }
        ]

    if rule_groups_by_code:
        raise CompletedCourseUpdateError(
            'Choose a compatible regulation area before saving this course.'
        )

    return None, str(course['masterCat']), False, []


def _coerce_stored_completed_course(raw_course: Any, fallback_id: str) -> StoredCompletedCourse | None:
    if not isinstance(raw_course, dict):
        return None

    title = _safe_text(raw_course.get('title'))
    semester = _safe_text(raw_course.get('semester'))
    if not title or not semester:
        return None

    master_cat = _normalize_master_cat(raw_course.get('masterCat'))
    study_area_code = _normalize_study_area_code(raw_course.get('studyAreaCode'))
    if study_area_code:
        master_cat = _rule_group_code_to_master_cat(study_area_code) or master_cat
    if master_cat not in ALLOWED_MASTER_CATEGORIES:
        master_cat = 'BASIS'

    course_id: int | None = None
    raw_course_id = raw_course.get('courseId')
    if raw_course_id not in {None, ''}:
        try:
            course_id = int(raw_course_id)
        except (TypeError, ValueError):
            course_id = None

    return StoredCompletedCourse(
        id=_safe_text(raw_course.get('id')) or fallback_id,
        courseId=course_id,
        externalCourseCode=_safe_text(raw_course.get('externalCourseCode')),
        title=title,
        ects=_optional_float(raw_course.get('ects')) or 0.0,
        masterCat=master_cat,
        studyAreaCode=study_area_code,
        grade=_optional_float(raw_course.get('grade')),
        semester=semester,
        source=_safe_text(raw_course.get('source')) or 'manual',
        createdAtUnix=_optional_unix(raw_course.get('createdAtUnix')),
        updatedAtUnix=_optional_unix(raw_course.get('updatedAtUnix')),
    )


async def _load_stored_completed_courses(env: Any, username: str) -> list[StoredCompletedCourse]:
    stored_value = await load_user_progress_json(env, username, 'completed_courses_json')
    stored_courses = [
        completed_course
        for index, raw_course in enumerate(parse_json_array(stored_value))
        if (completed_course := _coerce_stored_completed_course(raw_course, str(index + 1))) is not None
    ]
    stored_courses.sort(
        key=lambda course: (
            _safe_text(course.get('semester')) or '',
            int(course.get('createdAtUnix') or 0),
            str(course.get('id') or ''),
        ),
        reverse=True,
    )
    return stored_courses


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


async def _validate_course_ids(env: Any, course_ids: list[int]) -> None:
    if not course_ids:
        return

    unique_course_ids = sorted(set(course_ids))
    placeholders = ', '.join('?' for _ in unique_course_ids)
    rows = await fetch_all(
        env,
        f'SELECT id FROM courses WHERE id IN ({placeholders})',
        unique_course_ids,
    )
    existing_ids = {int(row['id']) for row in rows}
    missing_ids = [course_id for course_id in unique_course_ids if course_id not in existing_ids]
    if missing_ids:
        raise CompletedCourseUpdateError(
            'Unknown course ids in completed-course payload: '
            + ', '.join(str(course_id) for course_id in missing_ids)
        )


async def _serialize_completed_courses(
    env: Any,
    username: str,
    regulation_version_id: int | None,
) -> list[dict[str, Any]]:
    stored_courses = await _load_stored_completed_courses(env, username)
    course_ids = [int(course['courseId']) for course in stored_courses if course.get('courseId') is not None]
    course_numbers = await _load_course_numbers_by_id(env, course_ids)
    course_options = await _load_course_rule_group_options(env, regulation_version_id, course_ids)
    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)

    serialized_courses: list[dict[str, Any]] = []
    for stored_course in stored_courses:
        course_id = int(stored_course['courseId']) if stored_course.get('courseId') is not None else None
        row_options = course_options.get(course_id or -1, [])
        resolved_study_area_code = _normalize_study_area_code(stored_course.get('studyAreaCode'))
        master_cat = _normalize_master_cat(stored_course.get('masterCat'))
        if resolved_study_area_code:
            master_cat = _rule_group_code_to_master_cat(resolved_study_area_code) or master_cat
        if master_cat not in ALLOWED_MASTER_CATEGORIES:
            master_cat = 'BASIS'

        assignable_options = _build_assignable_options(
            CompletedCoursePayload(
                masterCat=master_cat,
                studyAreaCode=resolved_study_area_code,
            ),
            row_options,
            rule_groups_by_code,
        )
        assignable_codes = [
            option['studyAreaCode'] for option in assignable_options if option.get('studyAreaCode')
        ]
        unique_assignable_codes = list(dict.fromkeys(assignable_codes))
        category_locked = len(unique_assignable_codes) == 1
        if resolved_study_area_code is None and category_locked:
            resolved_study_area_code = unique_assignable_codes[0]

        rule_group = (
            rule_groups_by_code.get(resolved_study_area_code)
            if resolved_study_area_code is not None
            else None
        )

        serialized_courses.append(
            {
                'id': str(stored_course['id']),
                'courseId': str(course_id) if course_id is not None else None,
                'courseNumber': course_numbers.get(course_id) if course_id is not None else None,
                'externalCourseCode': _safe_text(stored_course.get('externalCourseCode')),
                'title': str(stored_course['title']),
                'ects': float(stored_course['ects']),
                'masterCat': master_cat,
                'studyAreaCode': resolved_study_area_code,
                'studyAreaName': _safe_text(rule_group.get('name')) if rule_group else None,
                'availableStudyAreaOptions': assignable_options,
                'categoryLocked': category_locked,
                'isGradeCounted': resolved_study_area_code != 'UEBK',
                'grade': _optional_float(stored_course.get('grade')),
                'semester': str(stored_course['semester']),
                'source': _safe_text(stored_course.get('source')) or 'manual',
            }
        )
    return serialized_courses


async def get_current_user_completed_courses(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    regulation_version_id = (
        int(user['profile']['regulationVersionId'])
        if user['profile'].get('regulationVersionId') is not None
        else None
    )
    completed_courses = await _serialize_completed_courses(
        env,
        str(user['username']),
        regulation_version_id,
    )
    return {
        'completedCourses': completed_courses,
        'count': len(completed_courses),
    }


async def _persist_stored_completed_courses(
    env: Any,
    username: str,
    stored_courses: list[StoredCompletedCourse],
) -> None:
    await update_user_progress_json(env, username, 'completed_courses_json', stored_courses)


def _next_completed_course_id() -> str:
    return secrets.token_hex(8)


def _build_stored_completed_course(
    course: CompletedCoursePayload,
    *,
    current_unix: int,
    existing_created_at_unix: int | None,
) -> StoredCompletedCourse:
    return StoredCompletedCourse(
        id=course.get('id') or _next_completed_course_id(),
        courseId=str(int(course['courseId'])) if course.get('courseId') is not None else None,
        externalCourseCode=course.get('externalCourseCode'),
        title=course['title'],
        ects=float(course['ects']),
        masterCat=course['masterCat'],
        studyAreaCode=course.get('studyAreaCode'),
        grade=course.get('grade'),
        semester=course['semester'],
        source=course['source'],
        createdAtUnix=existing_created_at_unix if existing_created_at_unix is not None else current_unix,
        updatedAtUnix=current_unix,
    )


async def import_current_user_completed_courses(
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

    raw_imports = payload.get('imports')
    if raw_imports is None:
        raise CompletedCourseUpdateError('An imports array is required.')
    if not isinstance(raw_imports, list):
        raise CompletedCourseUpdateError('imports must be an array.')

    parsed_imports: list[tuple[str, CompletedCoursePayload]] = []
    failed: list[dict[str, str]] = []

    for index, raw_item in enumerate(raw_imports):
        if not isinstance(raw_item, dict):
            failed.append({'id': str(index), 'message': 'Each import item must be a JSON object.'})
            continue

        item_id = _safe_text(raw_item.get('id')) or str(index)
        try:
            normalized_course = _normalize_completed_course(raw_item.get('course'))
        except CompletedCourseUpdateError as exc:
            failed.append({'id': item_id, 'message': str(exc)})
            continue
        parsed_imports.append((item_id, normalized_course))

    incoming_course_ids = sorted(
        {
            int(course['courseId'])
            for _, course in parsed_imports
            if course['courseId'] is not None
        }
    )
    valid_course_ids: set[int] = set()
    if incoming_course_ids:
        placeholders = ', '.join('?' for _ in incoming_course_ids)
        rows = await fetch_all(
            env,
            f'SELECT id FROM courses WHERE id IN ({placeholders})',
            incoming_course_ids,
        )
        valid_course_ids = {int(row['id']) for row in rows}

    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)
    course_options = await _load_course_rule_group_options(env, regulation_version_id, incoming_course_ids)
    existing_stored_courses = await _load_stored_completed_courses(env, username)
    seen_keys = {_normalize_completed_course_key(course) for course in existing_stored_courses}
    next_stored_courses = list(existing_stored_courses)
    imported: list[dict[str, str]] = []
    skipped_duplicates: list[dict[str, str]] = []
    current_unix = _now_unix()

    for item_id, course in parsed_imports:
        course_id = int(course['courseId']) if course['courseId'] is not None else None
        if course_id is not None and course_id not in valid_course_ids:
            failed.append({'id': item_id, 'message': f'Unknown course id in completed-course payload: {course_id}'})
            continue

        mapped_options = course_options.get(course_id or -1, [])
        try:
            study_area_code, resolved_master_cat, _, _ = _resolve_assignment(
                course,
                mapped_options,
                rule_groups_by_code,
            )
        except CompletedCourseUpdateError as exc:
            failed.append({'id': item_id, 'message': str(exc)})
            continue

        normalized_course = CompletedCoursePayload(
            course,
            studyAreaCode=study_area_code,
            masterCat=resolved_master_cat,
        )
        course_key = _normalize_completed_course_key(normalized_course)
        if course_key in seen_keys:
            skipped_duplicates.append(
                {'id': item_id, 'message': 'The selected course data is already stored in your completed-course list.'}
            )
            continue

        next_stored_courses.append(
            _build_stored_completed_course(
                normalized_course,
                current_unix=current_unix,
                existing_created_at_unix=None,
            )
        )
        seen_keys.add(course_key)
        imported.append({'id': item_id, 'message': 'Imported successfully.'})

    await _persist_stored_completed_courses(env, username, next_stored_courses)
    saved_completed_courses = await _serialize_completed_courses(env, username, regulation_version_id)
    return {
        'completedCourses': saved_completed_courses,
        'count': len(saved_completed_courses),
        'imported': imported,
        'skippedDuplicates': skipped_duplicates,
        'failed': failed,
        'importedCount': len(imported),
        'skippedDuplicateCount': len(skipped_duplicates),
        'failedCount': len(failed),
    }


async def replace_current_user_completed_courses(
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

    raw_completed_courses = payload.get('completedCourses')
    if raw_completed_courses is None:
        raise CompletedCourseUpdateError('A completedCourses array is required.')
    if not isinstance(raw_completed_courses, list):
        raise CompletedCourseUpdateError('completedCourses must be an array.')

    completed_courses = [_normalize_completed_course(item) for item in raw_completed_courses]
    course_ids = [course['courseId'] for course in completed_courses if course['courseId'] is not None]
    validated_course_ids = [int(course_id) for course_id in course_ids]
    await _validate_course_ids(env, validated_course_ids)

    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)
    course_options = await _load_course_rule_group_options(env, regulation_version_id, validated_course_ids)
    existing_stored_courses = await _load_stored_completed_courses(env, username)
    existing_created_by_id = {
        str(course['id']): int(course.get('createdAtUnix') or 0)
        for course in existing_stored_courses
        if course.get('id')
    }

    normalized_courses: list[StoredCompletedCourse] = []
    current_unix = _now_unix()
    for course in completed_courses:
        mapped_options = course_options.get(int(course['courseId']), []) if course['courseId'] is not None else []
        study_area_code, resolved_master_cat, _, _ = _resolve_assignment(
            course,
            mapped_options,
            rule_groups_by_code,
        )
        normalized_course = CompletedCoursePayload(
            course,
            studyAreaCode=study_area_code,
            masterCat=resolved_master_cat,
        )
        existing_id = _safe_text(course.get('id'))
        normalized_courses.append(
            _build_stored_completed_course(
                normalized_course,
                current_unix=current_unix,
                existing_created_at_unix=existing_created_by_id.get(existing_id) if existing_id else None,
            )
        )

    await _persist_stored_completed_courses(env, username, normalized_courses)
    saved_completed_courses = await _serialize_completed_courses(env, username, regulation_version_id)
    return {
        'completedCourses': saved_completed_courses,
        'count': len(saved_completed_courses),
    }

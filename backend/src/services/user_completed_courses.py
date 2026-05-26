from __future__ import annotations

import time
from typing import Any

from db.d1 import execute, fetch_all
from services.authentication import require_authenticated_user

ALLOWED_MASTER_CATEGORIES = {'TECH', 'THEO', 'PRAK', 'INFO', 'BASIS'}
ALLOWED_GRADE_VALUES = (1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0)
LEGACY_MASTER_CATEGORY_ALIASES = {'FOKUS': 'BASIS'}


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


def _normalize_study_area_code(value: Any) -> str | None:
    normalized_value = _safe_text(value)
    return normalized_value.upper() if normalized_value else None


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


async def _load_rule_groups_for_regulation(
    env: Any,
    regulation_version_id: int | None,
) -> dict[str, dict[str, Any]]:
    if regulation_version_id is None:
        return {}

    rows = await fetch_all(
        env,
        """
        SELECT code, name, group_type AS groupType
        FROM regulation_rule_groups
        WHERE regulation_version_id = ?
        ORDER BY sort_order ASC, code ASC
        """,
        [regulation_version_id],
    )
    return {
        _normalize_study_area_code(row.get('code')) or '': row
        for row in rows
        if _normalize_study_area_code(row.get('code'))
    }


async def _load_course_rule_group_options(
    env: Any,
    regulation_version_id: int | None,
    course_ids: list[int],
) -> dict[int, list[dict[str, Any]]]:
    if regulation_version_id is None or not course_ids:
        return {}

    placeholders = ', '.join('?' for _ in course_ids)
    rows = await fetch_all(
        env,
        f"""
        SELECT
            rcm.course_id AS courseId,
            rrg.code AS studyAreaCode,
            rrg.name AS studyAreaName,
            rrg.group_type AS groupType,
            rrg.sort_order AS sortOrder
        FROM regulation_course_mappings AS rcm
        JOIN regulation_rule_groups AS rrg ON rrg.id = rcm.rule_group_id
        WHERE rcm.regulation_version_id = ?
          AND rcm.course_id IN ({placeholders})
        ORDER BY rcm.course_id ASC, rrg.sort_order ASC, rrg.code ASC
        """,
        [regulation_version_id, *course_ids],
    )

    options_by_course_id: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        course_id = int(row['courseId'])
        study_area_code = _normalize_study_area_code(row.get('studyAreaCode'))
        if not study_area_code:
            continue
        options_for_course = options_by_course_id.setdefault(course_id, [])
        if any(option['studyAreaCode'] == study_area_code for option in options_for_course):
            continue
        options_for_course.append(
            {
                'studyAreaCode': study_area_code,
                'studyAreaName': _safe_text(row.get('studyAreaName')),
                'groupType': _safe_text(row.get('groupType')),
            }
        )
    return options_by_course_id


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


async def _serialize_completed_courses(
    env: Any,
    user_id: int,
    regulation_version_id: int | None,
) -> list[dict[str, Any]]:
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
            ucc.study_area_code AS studyAreaCode,
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

    course_ids = [int(row['courseId']) for row in rows if row.get('courseId') is not None]
    course_options = await _load_course_rule_group_options(env, regulation_version_id, course_ids)
    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)

    serialized_courses: list[dict[str, Any]] = []
    for row in rows:
        course_id = int(row['courseId']) if row.get('courseId') is not None else None
        row_options = course_options.get(course_id or -1, [])
        resolved_study_area_code = _normalize_study_area_code(row.get('studyAreaCode'))
        master_cat = _normalize_master_cat(row.get('masterCat'))
        if resolved_study_area_code:
            master_cat = _rule_group_code_to_master_cat(resolved_study_area_code) or master_cat

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
                'id': str(int(row['id'])),
                'courseId': str(course_id) if course_id is not None else None,
                'courseNumber': _safe_text(row.get('courseNumber')),
                'externalCourseCode': _safe_text(row.get('externalCourseCode')),
                'title': row['title'],
                'ects': float(row['ects']),
                'masterCat': master_cat,
                'studyAreaCode': resolved_study_area_code,
                'studyAreaName': _safe_text(rule_group.get('name')) if rule_group else None,
                'availableStudyAreaOptions': assignable_options,
                'categoryLocked': category_locked,
                'isGradeCounted': resolved_study_area_code != 'UEBK',
                'grade': float(row['grade']) if row.get('grade') is not None else None,
                'semester': row['semester'],
                'source': row['source'],
            }
        )
    return serialized_courses


async def get_current_user_completed_courses(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    completed_courses = await _serialize_completed_courses(
        env,
        int(user['id']),
        int(user['profile']['regulationVersionId']) if user['profile'].get('regulationVersionId') is not None else None,
    )
    return {
        'completedCourses': completed_courses,
        'count': len(completed_courses),
    }


async def _insert_completed_course(
    env: Any,
    user_id: int,
    course: CompletedCoursePayload,
    *,
    now_unix: int,
) -> None:
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
            study_area_code,
            grade,
            semester,
            source,
            created_at_unix,
            updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            user_id,
            course['courseId'],
            course['externalCourseCode'],
            course['title'],
            course['ects'],
            course['masterCat'],
            course['studyAreaCode'],
            course['grade'],
            course['semester'],
            course['source'],
            now_unix,
            now_unix,
        ],
    )


async def import_current_user_completed_courses(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    user_id = int(user['id'])
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
    existing_rows = await fetch_all(
        env,
        """
        SELECT course_id AS courseId, title, semester, ects, grade
        FROM user_completed_courses
        WHERE user_id = ?
        """,
        [user_id],
    )
    seen_keys = {_normalize_completed_course_key(row) for row in existing_rows}
    imported: list[dict[str, str]] = []
    skipped_duplicates: list[dict[str, str]] = []
    now_unix = _now_unix()

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

        await _insert_completed_course(env, user_id, normalized_course, now_unix=now_unix)
        seen_keys.add(course_key)
        imported.append({'id': item_id, 'message': 'Imported successfully.'})

    saved_completed_courses = await _serialize_completed_courses(env, user_id, regulation_version_id)
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
    user_id = int(user['id'])
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

    normalized_courses: list[CompletedCoursePayload] = []
    for course in completed_courses:
        mapped_options = course_options.get(int(course['courseId']), []) if course['courseId'] is not None else []
        study_area_code, resolved_master_cat, _, _ = _resolve_assignment(
            course,
            mapped_options,
            rule_groups_by_code,
        )
        normalized_courses.append(
            CompletedCoursePayload(
                course,
                studyAreaCode=study_area_code,
                masterCat=resolved_master_cat,
            )
        )

    await execute(env, 'DELETE FROM user_completed_courses WHERE user_id = ?', [user_id])
    now_unix = _now_unix()
    for course in normalized_courses:
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
                study_area_code,
                grade,
                semester,
                source,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                user_id,
                course['courseId'],
                course['externalCourseCode'],
                course['title'],
                course['ects'],
                course['masterCat'],
                course['studyAreaCode'],
                course['grade'],
                course['semester'],
                course['source'],
                now_unix,
                now_unix,
            ],
        )

    saved_completed_courses = await _serialize_completed_courses(env, user_id, regulation_version_id)
    return {
        'completedCourses': saved_completed_courses,
        'count': len(saved_completed_courses),
    }

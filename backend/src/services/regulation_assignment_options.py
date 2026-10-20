from __future__ import annotations

import json
from typing import Any

from db.d1 import fetch_all


def safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_study_area_code(value: Any) -> str | None:
    normalized_value = safe_text(value)
    return normalized_value.upper() if normalized_value else None


def normalize_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def study_area_code_to_master_cat(code: str | None) -> str | None:
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


async def load_regulation_rule_groups(
    env: Any,
    regulation_version_id: int | None,
) -> dict[str, dict[str, Any]]:
    if regulation_version_id is None:
        return {}

    rows = await fetch_all(
        env,
        """
        SELECT
            code,
            name,
            group_type AS groupType,
            required_ects AS requiredEcts,
            max_ects AS maxEcts,
            sort_order AS sortOrder
        FROM regulation_rule_groups
        WHERE regulation_version_id = ?
        ORDER BY sort_order ASC, code ASC
        """,
        [regulation_version_id],
    )

    rule_groups: dict[str, dict[str, Any]] = {}
    for row in rows:
        code = normalize_study_area_code(row.get('code'))
        if not code:
            continue
        rule_groups[code] = {
            **row,
            'code': code,
            'name': safe_text(row.get('name')),
            'groupType': safe_text(row.get('groupType')),
            'requiredEcts': normalize_optional_float(row.get('requiredEcts')),
            'maxEcts': normalize_optional_float(row.get('maxEcts')),
            'sortOrder': int(row.get('sortOrder') or 0),
        }
    return rule_groups


async def load_regulation_course_options(
    env: Any,
    regulation_version_id: int | None,
    course_ids: list[int],
    *,
    allowed_only: bool = False,
) -> dict[int, list[dict[str, Any]]]:
    if regulation_version_id is None or not course_ids:
        return {}

    unique_course_ids = list(dict.fromkeys(course_ids))
    course_ids_json = json.dumps(unique_course_ids)
    status_filter = "AND rcm.status IN ('allowed', 'required', 'mandatory', 'pflicht')" if allowed_only else ''
    rows = await fetch_all(
        env,
        f"""
        SELECT
            rcm.course_id AS courseId,
            rrg.code AS studyAreaCode,
            rrg.name AS studyAreaName,
            rrg.group_type AS groupType,
            rrg.sort_order AS sortOrder,
            rcm.ects_counted AS ectsCounted,
            rcm.status AS optionStatus,
            rrg.group_type AS areaType
        FROM regulation_course_mappings AS rcm
        JOIN regulation_rule_groups AS rrg ON rrg.id = rcm.rule_group_id
        WHERE rcm.regulation_version_id = ?
          AND rcm.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
          {status_filter}
        ORDER BY rcm.course_id ASC, rrg.sort_order ASC, rrg.code ASC
        """,
        [regulation_version_id, course_ids_json],
    )

    # Catalog imports refresh these tables without rebuilding the legacy
    # regulation_course_mappings snapshot. Resolve them against the active PO.
    catalog_rows = await fetch_all(
        env,
        """
        SELECT m.course_id AS courseId, sa.code AS studyAreaCode,
               sa.area_type AS areaType, opt.status AS optionStatus,
               COALESCE(opt.ects_counted, cm.ects) AS ectsCounted,
               sp.code AS programCode, rv.code AS regulationCode
        FROM course_curriculum_matches AS m
        JOIN curriculum_modules AS cm ON cm.id = m.module_id
        JOIN module_study_area_options AS opt ON opt.module_id = cm.id
        JOIN study_areas AS sa ON sa.id = opt.study_area_id
        JOIN study_programs AS sp ON sp.id = sa.program_id
        JOIN study_program_regulation_versions AS spr ON spr.study_program_id = sp.id
        JOIN regulation_versions AS rv ON rv.id = spr.regulation_version_id
        WHERE rv.id = ? AND m.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
        UNION ALL
        SELECT l.course_id, sa.code, sa.area_type, 'allowed', NULL, sp.code, rv.code
        FROM course_study_area_links AS l
        JOIN study_areas AS sa ON sa.id = l.study_area_id
        JOIN study_programs AS sp ON sp.id = sa.program_id
        JOIN study_program_regulation_versions AS spr ON spr.study_program_id = sp.id
        JOIN regulation_versions AS rv ON rv.id = spr.regulation_version_id
        WHERE rv.id = ? AND l.course_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
        """,
        [regulation_version_id, course_ids_json, regulation_version_id, course_ids_json],
    )
    rule_groups = await load_regulation_rule_groups(env, regulation_version_id)
    options_by_course_id: dict[int, list[dict[str, Any]]] = {}
    for row in [*rows, *catalog_rows]:
        if (safe_text(row.get('optionStatus')) or 'allowed').lower() in {'blocked', 'excluded', 'forbidden'}:
            continue
        course_id = int(row['courseId'])
        code = normalize_study_area_code(row.get('studyAreaCode'))
        area_type = (safe_text(row.get('areaType')) or '').lower()
        status = (safe_text(row.get('optionStatus')) or '').lower()
        compulsory = area_type not in {'wahlpflicht', 'elective', 'elective_area', 'structured_elective'} and (
            status in {'pflicht', 'required', 'mandatory'}
            or (code != 'UEBK' and area_type in {'pflicht', 'required', 'mandatory'})
        )
        if (compulsory and row.get('programCode') == 'BSC_INFO_2021'
                and row.get('regulationCode') == 'BSC_INFO_2021'
                and code == 'MATH' and 'MATH' not in rule_groups and 'INF' in rule_groups):
            code = 'INF'
        if not code or code not in rule_groups:
            if compulsory:
                options_by_course_id.setdefault(course_id, []).append({
                    'courseId': course_id, 'studyAreaCode': code,
                    'isCompulsory': True, 'isResolved': False,
                })
            continue
        group = rule_groups[code]
        option = {
            'courseId': course_id,
            'studyAreaCode': code,
            'studyAreaName': group.get('name'),
            'groupType': group.get('groupType'),
            'sortOrder': int(group.get('sortOrder') or 0),
            'ectsCounted': normalize_optional_float(row.get('ectsCounted')),
            'isCompulsory': compulsory,
            'isResolved': True,
        }
        options_by_course_id.setdefault(course_id, []).append(option)

    for course_id, options in options_by_course_id.items():
        compulsory_options = [option for option in options if option['isCompulsory']]
        deduplicated: dict[str, dict[str, Any]] = {}
        for option in compulsory_options or options:
            deduplicated.setdefault(option['studyAreaCode'], option)
        options_by_course_id[course_id] = list(deduplicated.values())
    return options_by_course_id


def is_flexible_rule_group(code: str, name: str | None, group_type: str | None) -> bool:
    normalized_code = code.upper()
    if normalized_code == 'THESIS':
        return False
    if normalized_code == 'UEBK':
        return True
    if (group_type or '').strip().lower() in {'elective_area', 'structured_elective'}:
        return True
    if normalized_code in {
        'PRAK', 'TECH', 'THEO', 'INFO', 'ELECTIVE', 'INFO-PRAK', 'INFO-TECH',
        'INFO-THEO', 'INFO-INFO', 'INFO-FOKUS', 'INFO-BASIS', 'ML-FOUND',
        'ML-DIVERSE', 'ML-CS', 'ML-EXP',
    }:
        return True
    return any(keyword in (name or '').strip().lower()
               for keyword in ('wahl', 'elective', 'fokus', 'basis', 'diverse', 'expanded'))


def compulsory_course_options(options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [option for option in options if option.get('isCompulsory')]


def has_unresolved_assignment_evidence(options: list[dict[str, Any]]) -> bool:
    return any(option.get('identityNeedsReview') or option.get('isResolved') is False for option in options)


def completed_catalog_id(course: dict[str, Any]) -> int | None:
    try:
        return int(course.get('courseId'))
    except (TypeError, ValueError):
        return None


def completed_identity_key(course: dict[str, Any]) -> str:
    # Include identity evidence so two stored rows sharing a reseeded ID cannot
    # lend each other trust.
    return repr((completed_catalog_id(course), course.get('title'),
                 course.get('externalCourseCode'), course.get('courseNumber')))


async def load_trusted_completed_course_options(
    env: Any,
    regulation_version_id: int | None,
    courses: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    course_ids = list({course_id for course in courses if (course_id := completed_catalog_id(course)) is not None})
    if regulation_version_id is None or not course_ids:
        return {}
    catalog_rows = await fetch_all(
        env,
        'SELECT id, number, unit_id AS unitId, title FROM courses WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))',
        [json.dumps(course_ids)],
    )
    catalog = {int(row['id']): row for row in catalog_rows}
    trusted_courses: dict[str, int] = {}
    for course in courses:
        course_id = completed_catalog_id(course)
        row = catalog.get(course_id)
        if not row:
            continue
        stored_codes = {safe_text(course.get(field)) for field in ('externalCourseCode', 'courseNumber')} - {None}
        catalog_codes = {safe_text(row.get('number')), safe_text(row.get('unitId'))} - {None}
        stored_title = (safe_text(course.get('title')) or '').casefold()
        catalog_title = (safe_text(row.get('title')) or '').casefold()
        # Reseeded IDs and generic numbers are not identity. Require a matching
        # title and reject every contradictory stored code, even if another fits.
        if stored_title and stored_title == catalog_title and stored_codes <= catalog_codes:
            trusted_courses[completed_identity_key(course)] = course_id
    options = await load_regulation_course_options(env, regulation_version_id, list(trusted_courses.values()))
    return {
        completed_identity_key(course): options.get(trusted_courses[completed_identity_key(course)], [])
        if completed_identity_key(course) in trusted_courses else [{'identityNeedsReview': True}]
        for course in courses if completed_catalog_id(course) is not None
    }


def canonicalize_compulsory_assignment(
    course: dict[str, Any],
    options: list[dict[str, Any]],
) -> dict[str, Any]:
    course = {key: value for key, value in course.items() if key != 'assignmentNeedsReview'}
    compulsory = compulsory_course_options(options)
    if has_unresolved_assignment_evidence(options):
        return {**course, 'assignmentNeedsReview': True}
    if len(compulsory) > 1 and normalize_study_area_code(course.get('studyAreaCode')) not in {
        option['studyAreaCode'] for option in compulsory
    }:
        return {**course, 'assignmentNeedsReview': True}
    if len(compulsory) != 1:
        return dict(course)
    code = compulsory[0]['studyAreaCode']
    return {
        **course, 'studyAreaCode': code,
        'masterCat': study_area_code_to_master_cat(code) or course.get('masterCat'),
    }


async def canonicalize_completed_courses(
    env: Any,
    regulation_version_id: int | None,
    courses: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    options = await load_trusted_completed_course_options(env, regulation_version_id, courses)
    return [canonicalize_compulsory_assignment(
        course, options.get(completed_identity_key(course), []),
    ) for course in courses]

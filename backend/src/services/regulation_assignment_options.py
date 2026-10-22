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

    # The catalog and validator share one eligibility builder; legacy mappings remain
    # as a compatibility source, but never override corrected catalog eligibility.
    from services.course_catalog import _build_credit_metadata, _load_catalog_option_rows
    from services.official_regulations import get_official_regulation

    version = await fetch_all(env, 'SELECT code FROM regulation_versions WHERE id = ?', [regulation_version_id])
    regulation_code = safe_text(version[0].get('code')) if version else None
    catalog_rows = await _load_catalog_option_rows(env, unique_course_ids)
    course_rows = await fetch_all(
        env,
        'SELECT id, number, unit_id AS unitId, title, course_type AS courseType FROM courses '
        'WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))',
        [course_ids_json],
    )
    courses_by_id = {int(row['id']): row for row in course_rows}
    metadata_options: list[dict[str, Any]] = []
    for course_id in unique_course_ids:
        course = courses_by_id.get(course_id)
        if not course:
            continue
        metadata = _build_credit_metadata(
            [row for row in catalog_rows if int(row['courseId']) == course_id],
            course_number=safe_text(course.get('number') or course.get('unitId')),
            title=safe_text(course.get('title')), course_type=safe_text(course.get('courseType')),
            module_ects=None,
        )
        program = next((item for item in metadata['programs']
                        if item['programCode'] == regulation_code), None)
        policy = get_official_regulation(regulation_code)
        eligible_areas = list((program or {}).get('allowedAreaCodes', []))
        if policy:
            from services.official_regulations import canonical_module_code
            canonical = canonical_module_code(regulation_code, course.get('number'), course.get('unitId'))
            owner = next((group['code'] for group in policy['ruleGroups']
                          if any(module['code'] == canonical for module in group['modules'])), None)
            if owner and owner not in eligible_areas:
                eligible_areas.append(owner)
        for area in eligible_areas:
            group = next((item for item in (policy or {}).get('ruleGroups', [])
                          if item['code'] == area), None)
            source = next((row for row in catalog_rows if int(row['courseId']) == course_id
                           and row.get('programCode') == regulation_code
                           and normalize_study_area_code(row.get('studyAreaCode')) == area), {})
            metadata_options.append({
                'courseId': course_id, 'programCode': regulation_code,
                'regulationCode': regulation_code, 'studyAreaCode': area,
                'areaType': safe_text(source.get('areaType')) or (group or {}).get('groupType'),
                'optionStatus': safe_text(source.get('optionStatus')) or 'allowed',
                'ectsCounted': None, 'moduleCode': None,
            })

    rule_groups = await load_regulation_rule_groups(env, regulation_version_id)
    options_by_course_id: dict[int, list[dict[str, Any]]] = {}
    for row in [*rows, *metadata_options]:
        if (safe_text(row.get('optionStatus')) or 'allowed').lower() in {'blocked', 'excluded', 'forbidden'}:
            continue
        course_id = int(row['courseId'])
        code = normalize_study_area_code(row.get('studyAreaCode'))
        area_type = (safe_text(row.get('areaType')) or '').lower()
        status = (safe_text(row.get('optionStatus')) or '').lower()
        if area_type in {'legacy_review', 'deprecated'}:
            continue
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
    if normalized_code == 'THESIS' or (group_type or '').strip().lower() in {'legacy_review', 'deprecated'}:
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
    program_rows = await fetch_all(
        env,
        'SELECT DISTINCT sp.code AS programCode FROM study_program_regulation_versions AS link '
        'JOIN study_programs AS sp ON sp.id = link.study_program_id '
        'WHERE link.regulation_version_id = ?',
        [regulation_version_id],
    )
    program_codes = {safe_text(row.get('programCode')) for row in program_rows} - {None}
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
        # Reseeded IDs and generic numbers are not identity. Exact catalog identity
        # remains preferred; a source-backed PO alias is accepted only when every
        # stored code resolves to the catalog module and normalized titles agree.
        exact_identity = stored_title and stored_title == catalog_title and stored_codes <= catalog_codes
        alias_identity = False
        if stored_title and len(program_codes) == 1 and stored_codes and catalog_codes:
            from services.course_catalog import _normalize_course_identity_title
            from services.official_regulations import canonical_module_code

            program_code = next(iter(program_codes))
            catalog_module = canonical_module_code(program_code, *catalog_codes)
            stored_modules = {canonical_module_code(program_code, code) for code in stored_codes}
            normalized_titles = {
                _normalize_course_identity_title(stored_title, code)
                for code in stored_codes | catalog_codes
            }
            normalized_titles.discard('')
            catalog_normalized_title = _normalize_course_identity_title(
                safe_text(row.get('title')), safe_text(row.get('number') or row.get('unitId')) or '',
            )
            alias_identity = bool(
                catalog_module
                and stored_modules == {catalog_module}
                and catalog_normalized_title in normalized_titles
                and catalog_normalized_title
            )
        if exact_identity or alias_identity:
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
    evidence = course.get('recognitionEvidence')
    if isinstance(evidence, dict) and evidence.get('confirmed') is True:
        return dict(course)
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

from __future__ import annotations

import json
import secrets
from decimal import Decimal, InvalidOperation
from math import isfinite
from typing import Any

from db.d1 import fetch_all
from services.anrechnung_optimizer import optimize_anrechnung
from services.authentication import require_authenticated_user
from services.regulation_assignment_options import (
    is_flexible_rule_group as _is_flexible_rule_group,
    load_regulation_course_options as _load_course_rule_group_options,
    load_trusted_completed_course_options,
    canonicalize_compulsory_assignment,
    compulsory_course_options,
    has_unresolved_assignment_evidence,
    completed_identity_key,
    study_area_code_to_master_cat as _rule_group_code_to_master_cat,
    load_regulation_rule_groups as _load_rule_groups_for_regulation,
    normalize_study_area_code as _normalize_study_area_code,
)
from services.course_catalog import _build_credit_metadata
from services.official_regulations import (
    achievement_identity,
    assessment_types,
    canonical_module_code,
    find_duplicate_achievements,
    compute_credit_accounting,
    get_official_regulation,
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


def _normalize_course_source(source: Any, course_id: Any) -> str:
    normalized_source = (_safe_text(source) or '').lower()
    normalized_id = (_safe_text(course_id) or '').lower()
    if (
        normalized_source in {'transcript', 'transcript_import'}
        or normalized_id.startswith('import-')
        or normalized_id.startswith('transcript-')
    ):
        return 'transcript_import'
    return normalized_source or 'manual'


def _normalize_float(value: Any, *, field_name: str) -> float:
    try:
        normalized_value = float(value)
    except (TypeError, ValueError) as exc:
        raise CompletedCourseUpdateError(f'{field_name} must be numeric.') from exc
    if not isfinite(normalized_value) or normalized_value < 0:
        raise CompletedCourseUpdateError(f'{field_name} must be finite and non-negative.')
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
    try:
        grade = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise CompletedCourseUpdateError('grade must be numeric.') from exc
    if not grade.is_finite() or grade < 1 or grade > 4 or max(0, -grade.as_tuple().exponent) > 2:
        raise CompletedCourseUpdateError('grade must be finite, between 1.0 and 4.0, with at most two decimals.')
    return float(grade)


def _normalize_completed_course(
    payload: Any, program_code: str | None = None,
) -> CompletedCoursePayload:
    if not isinstance(payload, dict):
        raise CompletedCourseUpdateError('Each completed course must be a JSON object.')

    title = _safe_text(payload.get('title'))
    if not title:
        raise CompletedCourseUpdateError('Each completed course requires a title.')

    semester = _safe_text(payload.get('semester'))
    if not semester:
        raise CompletedCourseUpdateError('Each completed course requires a semester label.')

    ects = _normalize_float(payload.get('ects'), field_name='ects')
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

    additional = payload.get('isAdditionalAchievement', False)
    if not isinstance(additional, bool):
        raise CompletedCourseUpdateError('isAdditionalAchievement must be a boolean.')
    assessment_type_value = _safe_text(payload.get('assessmentType'))
    valid_assessment_types = {'lecture', 'seminar', 'practical', 'research_project', 'exam', 'other'}
    if assessment_type_value and assessment_type_value not in valid_assessment_types:
        raise CompletedCourseUpdateError('assessmentType is invalid.')
    if program_code in {'MSC_INFO_2021', 'MSC_ML_2021'} and course_id is None and not assessment_type_value:
        raise CompletedCourseUpdateError('External master achievements require an explicit assessmentType.')

    recognition_evidence = payload.get('recognitionEvidence')
    if recognition_evidence is not None:
        policy = get_official_regulation(program_code)
        if (not isinstance(recognition_evidence, dict)
                or set(recognition_evidence) - {'confirmed', 'moduleCode', 'areaCode', 'componentKey', 'componentKind', 'assessmentType', 'countedEcts'}
                or recognition_evidence.get('confirmed') is not True
                or policy is None):
            raise CompletedCourseUpdateError('recognitionEvidence must be an explicit confirmed PO recognition declaration.')
        if recognition_evidence.get('moduleCode') is not None:
            allowed_modules = {module['code'] for group in policy['ruleGroups'] for module in group['modules']}
            if recognition_evidence['moduleCode'] not in allowed_modules:
                raise CompletedCourseUpdateError('recognitionEvidence.moduleCode is not part of your active PO.')
        if recognition_evidence.get('areaCode') is not None:
            allowed_areas = {group['code'] for group in policy['ruleGroups']}
            if recognition_evidence['areaCode'] not in allowed_areas:
                raise CompletedCourseUpdateError('recognitionEvidence.areaCode is not part of your active PO.')
        if not recognition_evidence.get('moduleCode') and not recognition_evidence.get('areaCode'):
            raise CompletedCourseUpdateError('recognitionEvidence requires a recognized moduleCode or areaCode.')
        if recognition_evidence.get('moduleCode') and recognition_evidence.get('areaCode'):
            owners = {group['code'] for group in policy['ruleGroups']
                      if any(module['code'] == recognition_evidence['moduleCode'] for module in group['modules'])}
            if owners != {recognition_evidence['areaCode']}:
                raise CompletedCourseUpdateError('recognitionEvidence moduleCode and areaCode must identify the same PO module.')
        recognition_assessment_type = recognition_evidence.get('assessmentType')
        if recognition_assessment_type is not None and recognition_assessment_type not in valid_assessment_types:
            raise CompletedCourseUpdateError('recognitionEvidence.assessmentType is invalid.')
        counted_ects = recognition_evidence.get('countedEcts')
        if counted_ects is not None:
            try:
                counted_value = Decimal(str(counted_ects))
                raw_ects_value = Decimal(str(ects))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise CompletedCourseUpdateError('recognitionEvidence.countedEcts must be numeric.') from exc
            if (not counted_value.is_finite() or counted_value < 0 or counted_value > raw_ects_value
                    or (recognized_area := _normalize_study_area_code(recognition_evidence.get('areaCode'))) == 'THESIS'
                    and counted_value != raw_ects_value):
                raise CompletedCourseUpdateError('recognitionEvidence.countedEcts must be between zero and recorded ECTS; thesis credit cannot be partial.')
        component_kind = recognition_evidence.get('componentKind')
        if component_kind is not None and component_kind not in {'whole', 'written', 'oral', 'component'}:
            raise CompletedCourseUpdateError('recognitionEvidence.componentKind is invalid.')
        if component_kind == 'component' and not _safe_text(recognition_evidence.get('componentKey')):
            raise CompletedCourseUpdateError('A recognized assessment component requires componentKey.')

    selected_area = _normalize_study_area_code(payload.get('studyAreaCode'))
    recognized_area = _normalize_study_area_code(
        recognition_evidence.get('areaCode') if isinstance(recognition_evidence, dict) else None,
    )
    if selected_area and recognized_area and selected_area != recognized_area:
        raise CompletedCourseUpdateError('studyAreaCode must match recognitionEvidence.areaCode.')

    return CompletedCoursePayload(
        id=_safe_text(payload.get('id')),
        recognitionEvidence=recognition_evidence,
        assessmentType=assessment_type_value,
        isAdditionalAchievement=additional,
        courseId=course_id,
        externalCourseCode=_safe_text(payload.get('externalCourseCode')),
        courseNumber=_safe_text(payload.get('courseNumber')),
        title=title,
        ects=ects,
        masterCat=master_cat,
        studyAreaCode=selected_area or recognized_area,
        grade=grade,
        semester=semester,
        source=_normalize_course_source(payload.get('source'), payload.get('id')),
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
    if has_unresolved_assignment_evidence(mapped_options):
        return []
    compulsory = compulsory_course_options(mapped_options)
    if compulsory:
        return compulsory
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
    if has_unresolved_assignment_evidence(mapped_options):
        raise CompletedCourseUpdateError(
            'This course has unresolved catalog identity or compulsory mapping and needs review before reassignment.'
        )
    selected_study_area_code = _normalize_study_area_code(course.get('studyAreaCode'))
    assignable_options = _build_assignable_options(course, mapped_options, rule_groups_by_code)
    assignable_codes = [option['studyAreaCode'] for option in assignable_options if option.get('studyAreaCode')]
    unique_assignable_codes = list(dict.fromkeys(assignable_codes))
    course_is_catalog_matched = course.get('courseId') is not None

    # An explicit selection (for example the regulation area the official
    # transcript counted a course toward) wins over auto-resolution, so a
    # compulsory module can be stored in its compulsory area even when the
    # catalog carries no mapping for it.
    if selected_study_area_code:
        rule_group = rule_groups_by_code.get(selected_study_area_code)
        if rule_group is None:
            raise CompletedCourseUpdateError(
                'The selected regulation area is not part of your active examination regulation.'
            )
        is_assignable = selected_study_area_code in unique_assignable_codes
        if compulsory_course_options(mapped_options) and not is_assignable:
            raise CompletedCourseUpdateError(
                'Compulsory courses can only be saved in their compulsory regulation area.'
            )
        is_flexible = _is_flexible_rule_group(
            selected_study_area_code,
            _safe_text(rule_group.get('name')),
            _safe_text(rule_group.get('groupType')),
        )
        # Catalog-matched courses (transcript imports and manual catalog picks)
        # may also use their compulsory area; anonymous manual rows without a
        # catalog course stay limited to flexible elective areas or ÜBK.
        recognition_confirmed = (
            isinstance(course.get('recognitionEvidence'), dict)
            and course['recognitionEvidence'].get('confirmed') is True
        )
        if not (is_assignable or is_flexible or course_is_catalog_matched or recognition_confirmed):
            raise CompletedCourseUpdateError(
                'Manual external courses can only be saved in flexible elective areas or ÜBK.'
            )
        resolved_master_cat = (
            _rule_group_code_to_master_cat(selected_study_area_code) or str(course['masterCat'])
        )
        return selected_study_area_code, resolved_master_cat, is_assignable, assignable_options or [
            {
                'studyAreaCode': selected_study_area_code,
                'studyAreaName': _safe_text(rule_group.get('name')),
                'groupType': _safe_text(rule_group.get('groupType')),
            }
        ]

    if unique_assignable_codes:
        if len(unique_assignable_codes) == 1:
            resolved_code = unique_assignable_codes[0]
            resolved_master_cat = _rule_group_code_to_master_cat(resolved_code) or str(course['masterCat'])
            return resolved_code, resolved_master_cat, True, assignable_options
        raise CompletedCourseUpdateError(
            'This course can count toward multiple regulation areas. Choose the correct regulation area before saving.'
        )

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
        recognitionEvidence=raw_course.get('recognitionEvidence'),
        assessmentType=_safe_text(raw_course.get('assessmentType')),
        isAdditionalAchievement=raw_course.get('isAdditionalAchievement') is True,
        courseId=course_id,
        externalCourseCode=_safe_text(raw_course.get('externalCourseCode')),
        courseNumber=_safe_text(raw_course.get('courseNumber')),
        title=title,
        ects=_optional_float(raw_course.get('ects')) or 0.0,
        masterCat=master_cat,
        studyAreaCode=study_area_code,
        grade=_optional_float(raw_course.get('grade')),
        semester=semester,
        source=_normalize_course_source(raw_course.get('source'), raw_course.get('id') or fallback_id),
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


async def _validate_course_ids(env: Any, course_ids: list[int]) -> None:
    if not course_ids:
        return

    unique_course_ids = sorted(set(course_ids))
    rows = await fetch_all(
        env,
        'SELECT id FROM courses WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))',
        [json.dumps(unique_course_ids)],
    )
    existing_ids = {int(row['id']) for row in rows}
    missing_ids = [course_id for course_id in unique_course_ids if course_id not in existing_ids]
    if missing_ids:
        raise CompletedCourseUpdateError(
            'Unknown course ids in completed-course payload: '
            + ', '.join(str(course_id) for course_id in missing_ids)
        )


async def _load_credit_metadata_by_course_code(
    env: Any,
    courses: list[dict[str, Any]],
    study_program_code: str | None,
) -> dict[str, dict[str, Any]]:
    import re

    stable_codes = list(dict.fromkeys(
        _safe_text(course.get(field))
        for course in courses for field in ('courseNumber', 'externalCourseCode')
        if _safe_text(course.get(field))
    ))
    lookup_codes = list(dict.fromkeys(
        candidate
        for code in stable_codes
        for candidate in (code, re.sub(r'\s*\((?:entspricht|alias|equivalent|gleichwertig)\b.*$', '', code, flags=re.I).strip())
        if candidate
    ))
    if not lookup_codes:
        return {}
    rows = await fetch_all(
        env,
        """SELECT COALESCE(c.number,c.unit_id) AS stableCode, c.course_type AS courseType,
                  cm.module_code AS moduleCode, cm.title AS moduleTitle, cm.ects AS moduleEcts,
                  cm.module_type AS moduleKind, cm.level AS moduleLevel,
                  sp.code AS programCode,
                  sa.code AS studyAreaCode, sa.name AS studyAreaName, sa.area_type AS areaType,
                  opt.status AS optionStatus, opt.ects_counted AS ectsCounted
           FROM courses c
           LEFT JOIN course_curriculum_matches m ON m.course_id=c.id
           LEFT JOIN curriculum_modules cm ON cm.id=m.module_id
           LEFT JOIN module_study_area_options opt ON opt.module_id=cm.id
           LEFT JOIN study_areas sa ON sa.id=opt.study_area_id
           LEFT JOIN study_programs sp ON sp.id=sa.program_id
           WHERE COALESCE(c.number,c.unit_id) IN (SELECT value FROM json_each(?))
           UNION ALL
           SELECT COALESCE(c.number,c.unit_id), c.course_type, NULL,NULL,NULL,NULL,NULL,
                  sp.code,sa.code,sa.name,sa.area_type,'allowed',NULL
           FROM courses c
           JOIN course_study_area_links l ON l.course_id=c.id
           JOIN study_areas sa ON sa.id=l.study_area_id
           JOIN study_programs sp ON sp.id=sa.program_id
           WHERE COALESCE(c.number,c.unit_id) IN (SELECT value FROM json_each(?))""",
        [json.dumps(lookup_codes), json.dumps(lookup_codes)],
    )
    by_code: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = _safe_text(row.get('stableCode'))
        if key:
            by_code.setdefault(key, []).append(row)
    result: dict[str, dict[str, Any]] = {}
    for course in courses:
        requested = _safe_text(course.get('courseNumber') or course.get('externalCourseCode'))
        if not requested:
            continue
        primary = re.sub(r'\s*\((?:entspricht|alias|equivalent|gleichwertig)\b.*$', '', requested, flags=re.I).strip()
        source_rows = by_code.get(requested) or by_code.get(primary) or []
        if not source_rows:
            continue
        course_types = {str(row['courseType']) for row in source_rows if row.get('courseType')}
        source_course_type = next(iter(course_types)) if len(course_types) == 1 else None
        metadata = _build_credit_metadata(
            source_rows, course_number=primary, title=_safe_text(course.get('title')),
            course_type=source_course_type,
            module_ects=None,
        )
        program = next((item for item in metadata['programs'] if item['programCode'] == study_program_code), None)
        metadata['assessmentTypes'] = assessment_types(source_course_type, _safe_text(course.get('title')))
        metadata['sourceCourseType'] = source_course_type
        metadata['allowedAreaCodes'] = program.get('allowedAreaCodes', []) if program else []
        program_modules = program.get('modules', []) if program else []
        module_codes = {item['moduleCode'] for item in program_modules if item.get('moduleKind') != 'pool'}
        metadata['moduleCode'] = next(iter(module_codes)) if len(module_codes) == 1 else None
        result[requested] = metadata
        result.setdefault(primary, metadata)
    return result


async def _load_course_numbers_by_id(env: Any, course_ids: list[int]) -> dict[int, str]:
    if not course_ids:
        return {}
    rows = await fetch_all(
        env,
        'SELECT id, number FROM courses WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))',
        [json.dumps(sorted(set(course_ids)))],
    )
    return {int(row['id']): str(row['number']) for row in rows if row.get('number') is not None}


async def _serialize_completed_courses(
    env: Any,
    username: str,
    regulation_version_id: int | None,
    study_program_code: str | None = None,
    regulation_preferences: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    stored_courses = await _load_stored_completed_courses(env, username)
    course_options = await load_trusted_completed_course_options(env, regulation_version_id, stored_courses)
    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)
    missing_number_ids = [int(course['courseId']) for course in stored_courses
                          if regulation_version_id is not None and course.get('courseId') is not None
                          and not course.get('courseNumber')
                          and not has_unresolved_assignment_evidence(course_options.get(completed_identity_key(course), []))]
    trusted_numbers = await _load_course_numbers_by_id(env, missing_number_ids) if missing_number_ids else {}
    metadata_courses = [{**course, 'courseNumber': course.get('courseNumber') or trusted_numbers.get(course.get('courseId'))}
                        for course in stored_courses]
    credit_metadata_by_code = await _load_credit_metadata_by_course_code(
        env, metadata_courses, study_program_code,
    )

    accounting_courses: list[dict[str, Any]] = []
    for index, stored_course in enumerate(stored_courses):
        course_options_for_accounting = course_options.get(completed_identity_key(stored_course), [])
        normalized = canonicalize_compulsory_assignment(stored_course, course_options_for_accounting)
        if not normalized.get('courseNumber'):
            normalized['courseNumber'] = trusted_numbers.get(normalized.get('courseId'))
        area_code = _normalize_study_area_code(normalized.get('studyAreaCode'))
        if area_code is None:
            account_options = _build_assignable_options(
                CompletedCoursePayload(
                    masterCat=_normalize_master_cat(normalized.get('masterCat')),
                    studyAreaCode=None,
                ), course_options_for_accounting, rule_groups_by_code,
            )
            unique_codes = list(dict.fromkeys(
                option['studyAreaCode'] for option in account_options if option.get('studyAreaCode')
            ))
            if len(unique_codes) == 1:
                area_code = unique_codes[0]
        stable_code = _safe_text(normalized.get('courseNumber') or normalized.get('externalCourseCode'))
        source_metadata = credit_metadata_by_code.get(stable_code or '', {})
        recognition_evidence = normalized.get('recognitionEvidence')
        recognized_module = (recognition_evidence.get('moduleCode')
                             if isinstance(recognition_evidence, dict) and recognition_evidence.get('confirmed') is True
                             else None)
        accounting_courses.append({
            'id': str(normalized.get('id') or index),
            'moduleCode': recognized_module or source_metadata.get('moduleCode') or canonical_module_code(
                study_program_code, normalized.get('courseNumber'),
                normalized.get('externalCourseCode'), normalized.get('title'),
            ),
            'courseNumber': normalized.get('courseNumber'),
            'externalCourseCode': normalized.get('externalCourseCode'),
            'title': normalized.get('title'), 'ects': normalized.get('ects'),
            'grade': normalized.get('grade'), 'studyAreaCode': area_code,
            'courseType': source_metadata.get('sourceCourseType'),
            'assessmentType': normalized.get('assessmentType'),
            'allowedAreaCodes': source_metadata.get('allowedAreaCodes'),
            'creditMetadata': source_metadata,
            'recognitionEvidence': recognition_evidence,
            'isAdditionalAchievement': normalized.get('isAdditionalAchievement') is True,
            'semester': normalized.get('semester'), 'createdAtUnix': normalized.get('createdAtUnix'),
            'assignmentNeedsReview': bool(normalized.get('assignmentNeedsReview')),
        })
    course_accounting = (
        compute_credit_accounting(
            study_program_code, accounting_courses, regulation_preferences,
        ).get('courseAccounting', {})
        if study_program_code else {}
    )

    serialized_courses: list[dict[str, Any]] = []
    for stored_course in stored_courses:
        course_id = int(stored_course['courseId']) if stored_course.get('courseId') is not None else None
        row_options = course_options.get(completed_identity_key(stored_course), [])
        stored_course = canonicalize_compulsory_assignment(stored_course, row_options)
        if not stored_course.get('courseNumber'):
            stored_course['courseNumber'] = trusted_numbers.get(stored_course.get('courseId'))
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
        if study_program_code == 'MSC_INFO_2021':
            basis_confirmed = bool((regulation_preferences or {}).get('mscInfoBasisAdmissionConfirmed'))
            unavailable_area = 'INFO-FOKUS' if basis_confirmed else 'INFO-BASIS'
            assignable_options = [option for option in assignable_options
                                  if option.get('studyAreaCode') != unavailable_area]
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

        stable_code = _safe_text(stored_course.get('courseNumber') or stored_course.get('externalCourseCode'))
        credit_metadata = credit_metadata_by_code.get(stable_code or '', {})
        recognition_evidence = stored_course.get('recognitionEvidence')
        recognized_module = (recognition_evidence.get('moduleCode')
                             if isinstance(recognition_evidence, dict) else None)
        credit_accounting = course_accounting.get(str(stored_course.get('id') or ''), {})
        serialized_courses.append(
            {
                'id': str(stored_course['id']),
                'courseId': str(course_id) if course_id is not None else None,
                'courseNumber': stored_course.get('courseNumber'),
                'externalCourseCode': _safe_text(stored_course.get('externalCourseCode')),
                'title': str(stored_course['title']),
                'ects': float(stored_course['ects']),
                'masterCat': master_cat,
                'studyAreaCode': resolved_study_area_code,
                'studyAreaName': _safe_text(rule_group.get('name')) if rule_group else None,
                'availableStudyAreaOptions': assignable_options,
                'categoryLocked': category_locked,
                'assignmentRestricted': bool(compulsory_course_options(row_options)) or has_unresolved_assignment_evidence(row_options),
                'assignmentNeedsReview': (bool(stored_course.get('assignmentNeedsReview'))
                                         or has_unresolved_assignment_evidence(row_options)
                                         or bool(credit_accounting.get('reviewReasons'))),
                'storedAssignmentNeedsReview': bool(stored_course.get('assignmentNeedsReview')),
                'earnedEcts': credit_accounting.get('earnedEcts', float(stored_course['ects'])),
                'uniqueEarnedEcts': credit_accounting.get('uniqueEarnedEcts', 0.0),
                'degreeCountedEcts': credit_accounting.get('degreeCountedEcts', 0.0),
                'gradeCountedEcts': credit_accounting.get('gradeCountedEcts', 0.0),
                'gradeUsedForAverage': credit_accounting.get('gradeUsedForAverage'),
                'creditReviewReasons': credit_accounting.get('reviewReasons', []),
                'creditMetadata': credit_metadata,
                'recognitionEvidence': recognition_evidence,
                'assessmentType': stored_course.get('assessmentType'),
                'isAdditionalAchievement': stored_course.get('isAdditionalAchievement') is True,
                'achievementKey': credit_accounting.get('achievementKey'),
                'canonicalModuleCode': (
                    credit_metadata.get('moduleCode')
                    or recognized_module
                    or canonical_module_code(
                        study_program_code, stored_course.get('courseNumber'),
                        stored_course.get('externalCourseCode'), stored_course.get('title'),
                    )
                ),
                'isGradeCounted': bool(credit_accounting.get('gradeCountedEcts', 0)),
                'grade': _optional_float(stored_course.get('grade')),
                'semester': str(stored_course['semester']),
                'createdAtUnix': stored_course.get('createdAtUnix') or 0,
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
        _safe_text(user['profile'].get('studyProgramCode')),
        user['profile'].get('regulationPreferences'),
    )
    return {
        'completedCourses': completed_courses,
        'count': len(completed_courses),
    }


async def get_current_user_anrechnung_optimization(env: Any, request: Any) -> dict[str, Any]:
    """Propose a better credit assignment for the user's completed courses.

    Read-only: it never writes. The editor presents the proposal and, on accept,
    applies it through the normal completed-course PUT (explicit studyAreaCode).
    """
    user = await require_authenticated_user(env, request)
    regulation_version_id = (
        int(user['profile']['regulationVersionId'])
        if user['profile'].get('regulationVersionId') is not None
        else None
    )
    serialized_courses = await _serialize_completed_courses(
        env,
        str(user['username']),
        regulation_version_id,
        _safe_text(user['profile'].get('studyProgramCode')),
        user['profile'].get('regulationPreferences'),
    )
    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)

    area_names: dict[str, str | None] = {
        code: _safe_text(rule_group.get('name')) for code, rule_group in rule_groups_by_code.items()
    }
    optimizer_courses: list[dict[str, Any]] = []
    title_by_id: dict[str, str] = {}
    for course in serialized_courses:
        options = course.get('availableStudyAreaOptions') or []
        candidate_codes: list[str] = []
        for option in options:
            code = _normalize_study_area_code(option.get('studyAreaCode'))
            if not code:
                continue
            candidate_codes.append(code)
            area_names.setdefault(code, _safe_text(option.get('studyAreaName')))
        title_by_id[str(course['id'])] = str(course.get('title') or '')
        optimizer_courses.append(
            {
                'id': str(course['id']),
                'ects': float(course.get('ects') or 0.0),
                'grade': course.get('grade'),
                'currentAreaCode': _normalize_study_area_code(course.get('studyAreaCode')),
                'candidateAreaCodes': candidate_codes,
                'assignmentNeedsReview': bool(course.get('assignmentNeedsReview')),
            }
        )

    rule_groups_list = [
        {'code': code, 'requiredEcts': rule_group.get('requiredEcts')}
        for code, rule_group in rule_groups_by_code.items()
    ]

    result = optimize_anrechnung(optimizer_courses, rule_groups_list)
    result['changes'] = [
        {
            **change,
            'title': title_by_id.get(change['completedCourseId']),
            'fromAreaName': area_names.get(change['fromAreaCode']) if change.get('fromAreaCode') else None,
            'toAreaName': area_names.get(change['toAreaCode']) if change.get('toAreaCode') else None,
        }
        for change in result['changes']
    ]
    return result


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
        recognitionEvidence=course.get('recognitionEvidence'),
        assessmentType=course.get('assessmentType'),
        isAdditionalAchievement=course.get('isAdditionalAchievement') is True,
        courseId=str(int(course['courseId'])) if course.get('courseId') is not None else None,
        externalCourseCode=course.get('externalCourseCode'),
        courseNumber=course.get('courseNumber'),
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
            normalized_course = _normalize_completed_course(raw_item.get('course'), _safe_text(user['profile'].get('studyProgramCode')))
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
        rows = await fetch_all(
            env,
            'SELECT id FROM courses WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))',
            [json.dumps(incoming_course_ids)],
        )
        valid_course_ids = {int(row['id']) for row in rows}

    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)
    course_options = await _load_course_rule_group_options(env, regulation_version_id, incoming_course_ids)
    existing_stored_courses = await _load_stored_completed_courses(env, username)
    existing_options = await load_trusted_completed_course_options(env, regulation_version_id, existing_stored_courses)
    next_stored_courses = [canonicalize_compulsory_assignment(
        course, existing_options.get(completed_identity_key(course), []),
    ) for course in existing_stored_courses]
    stored_index_by_key = {
        _normalize_completed_course_key(course): index
        for index, course in enumerate(next_stored_courses)
    }
    processed_import_keys: set[str] = set()
    imported: list[dict[str, str]] = []
    skipped_duplicates: list[dict[str, str]] = []
    current_unix = _now_unix()

    for item_id, course in parsed_imports:
        course_id = int(course['courseId']) if course['courseId'] is not None else None
        if course_id is not None and course_id not in valid_course_ids:
            failed.append({'id': item_id, 'message': f'Unknown course id in completed-course payload: {course_id}'})
            continue

        mapped_options = course_options.get(course_id or -1, [])
        regulation_preferences = user['profile'].get('regulationPreferences') or {}
        unavailable_area = (
            'INFO-FOKUS' if regulation_preferences.get('mscInfoBasisAdmissionConfirmed') else 'INFO-BASIS'
        )
        if (_safe_text(user['profile'].get('studyProgramCode')) == 'MSC_INFO_2021'
                and _normalize_study_area_code(course.get('studyAreaCode')) == unavailable_area):
            failed.append({
                'id': item_id,
                'message': f'{unavailable_area} is not permitted by the selected BASIS/FOKUS admission declaration.',
            })
            continue
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
        if course_key in processed_import_keys:
            skipped_duplicates.append(
                {'id': item_id, 'message': 'The selected course data is already part of this import.'}
            )
            continue

        existing_index = stored_index_by_key.get(course_key)
        if existing_index is not None:
            existing_course = next_stored_courses[existing_index]
            if has_unresolved_assignment_evidence(existing_options.get(completed_identity_key(existing_course), [])) or (
                existing_course.get('assignmentNeedsReview')
                and completed_identity_key(existing_course) != completed_identity_key(normalized_course)
            ):
                failed.append({'id': item_id, 'message': 'An existing course with this catalog ID needs identity review before replacement.'})
                continue
            if (
                normalized_course.get('source') == 'transcript_import'
                and _normalize_course_source(existing_course.get('source'), existing_course.get('id')) == 'transcript_import'
            ):
                normalized_course['id'] = existing_course.get('id')
                next_stored_courses[existing_index] = _build_stored_completed_course(
                    normalized_course,
                    current_unix=current_unix,
                    existing_created_at_unix=int(existing_course.get('createdAtUnix') or 0),
                )
                processed_import_keys.add(course_key)
                imported.append({'id': item_id, 'message': 'Updated transcript import successfully.'})
                continue

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
        stored_index_by_key[course_key] = len(next_stored_courses) - 1
        processed_import_keys.add(course_key)
        imported.append({'id': item_id, 'message': 'Imported successfully.'})

    await _persist_stored_completed_courses(env, username, next_stored_courses)
    saved_completed_courses = await _serialize_completed_courses(
        env, username, regulation_version_id, _safe_text(user['profile'].get('studyProgramCode')),
        user['profile'].get('regulationPreferences'),
    )
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

    completed_courses = [
        _normalize_completed_course(item, _safe_text(user['profile'].get('studyProgramCode')))
        for item in raw_completed_courses
    ]
    course_ids = [course['courseId'] for course in completed_courses if course['courseId'] is not None]
    validated_course_ids = [int(course_id) for course_id in course_ids]
    existing_stored_courses = await _load_stored_completed_courses(env, username)
    existing_by_id = {str(course['id']): course for course in existing_stored_courses}
    await _validate_course_ids(env, [
        int(course['courseId']) for course in completed_courses
        if course['courseId'] is not None and not (
            (existing := existing_by_id.get(str(course.get('id'))))
            and completed_identity_key(course) == completed_identity_key(existing)
            and course.get('studyAreaCode') == existing.get('studyAreaCode')
        )
    ])

    rule_groups_by_code = await _load_rule_groups_for_regulation(env, regulation_version_id)
    course_options = await _load_course_rule_group_options(env, regulation_version_id, validated_course_ids)
    trusted_existing_options = await load_trusted_completed_course_options(
        env, regulation_version_id, [*existing_stored_courses, *completed_courses],
    )
    existing_created_by_id = {
        str(course['id']): int(course.get('createdAtUnix') or 0)
        for course in existing_stored_courses
        if course.get('id')
    }

    normalized_courses: list[StoredCompletedCourse] = []
    current_unix = _now_unix()
    raw_by_id = {str(item.get('id')): item for item in raw_completed_courses if isinstance(item, dict) and item.get('id')}
    for course in completed_courses:
        mapped_options = course_options.get(int(course['courseId']), []) if course['courseId'] is not None else []
        existing = existing_by_id.get(str(course.get('id')))
        raw_item = raw_by_id.get(str(course.get('id')), {})
        if existing:
            if 'recognitionEvidence' not in raw_item:
                course['recognitionEvidence'] = existing.get('recognitionEvidence')
            if 'isAdditionalAchievement' not in raw_item:
                course['isAdditionalAchievement'] = existing.get('isAdditionalAchievement') is True
            if 'assessmentType' not in raw_item:
                course['assessmentType'] = existing.get('assessmentType')
        existing_options = trusted_existing_options.get(completed_identity_key(existing), []) if existing else []
        incoming_options = trusted_existing_options.get(completed_identity_key(course), [])
        if existing and course.get('courseId') == existing.get('courseId') and (
            completed_identity_key(course) == completed_identity_key(existing)
            or (not has_unresolved_assignment_evidence(existing_options)
                and not has_unresolved_assignment_evidence(incoming_options))
        ):
            mapped_options = existing_options
            if course.get('studyAreaCode') == existing.get('studyAreaCode'):
                canonical = canonicalize_compulsory_assignment(course, mapped_options)
                if canonical.get('assignmentNeedsReview'):
                    # Preserve unresolved rows in bulk PUTs without accepting a
                    # new placement or borrowing the current catalog ID's mapping.
                    normalized_courses.append(_build_stored_completed_course(
                        CompletedCoursePayload(canonical), current_unix=current_unix,
                        existing_created_at_unix=int(existing.get('createdAtUnix') or 0),
                    ))
                    continue
                course = CompletedCoursePayload(canonical)
        elif existing and course.get('courseId') == existing.get('courseId'):
            mapped_options = [{'identityNeedsReview': True}]
        regulation_preferences = user['profile'].get('regulationPreferences') or {}
        preserved_existing_area = bool(
            existing and course.get('studyAreaCode') == existing.get('studyAreaCode')
        )
        unavailable_area = (
            'INFO-FOKUS' if regulation_preferences.get('mscInfoBasisAdmissionConfirmed') else 'INFO-BASIS'
        )
        if (_safe_text(user['profile'].get('studyProgramCode')) == 'MSC_INFO_2021'
                and _normalize_study_area_code(course.get('studyAreaCode')) == unavailable_area
                and not preserved_existing_area):
            raise CompletedCourseUpdateError(
                f'{unavailable_area} is not permitted by the selected BASIS/FOKUS admission declaration.'
            )
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

    study_program_code = _safe_text(user['profile'].get('studyProgramCode'))
    if study_program_code:
        incoming_counts: dict[str, int] = {}
        existing_counts: dict[str, int] = {}
        for course in normalized_courses:
            key = achievement_identity(course, study_program_code)
            incoming_counts[key] = incoming_counts.get(key, 0) + 1
        for course in existing_stored_courses:
            key = achievement_identity(course, study_program_code)
            existing_counts[key] = existing_counts.get(key, 0) + 1
        new_duplicate_keys = [
            key for key, count in incoming_counts.items()
            if count > 1 and count > existing_counts.get(key, 0)
        ]
        if new_duplicate_keys:
            raise CompletedCourseUpdateError(
                'Duplicate curricular achievements were submitted; existing stored records were not changed.'
            )

    await _persist_stored_completed_courses(env, username, normalized_courses)
    saved_completed_courses = await _serialize_completed_courses(
        env, username, regulation_version_id, _safe_text(user['profile'].get('studyProgramCode')),
        user['profile'].get('regulationPreferences'),
    )
    return {
        'completedCourses': saved_completed_courses,
        'count': len(saved_completed_courses),
    }

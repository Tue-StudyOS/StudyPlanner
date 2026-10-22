"""Non-destructive, assessment-level projections from the verified PO reference."""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from services.official_regulations import (
    _decimal, _module_for_evidence, _safe_text, achievement_identity,
    assessment_types, get_official_regulation, grade_is_counted, truncate_official_grade,
    _source_module_metadata,
)


def _completion_order(item: tuple[int, dict[str, Any]]) -> tuple[int, int, int, str]:
    index, course = item
    semester = str(course.get('semester') or '').casefold()
    year = re.search(r'\b(\d{4})\b', semester)
    term = 1 if 'ws' in semester or 'winter' in semester else 0
    return (int(year.group(1)) if year else 9999, term,
            int(course.get('createdAtUnix') or 0), str(index).zfill(12))


def _completion_kind(course: dict[str, Any], amount: Decimal, budget: Decimal) -> str:
    evidence = course.get('recognitionEvidence') or {}
    explicit = evidence.get('componentKind') if isinstance(evidence, dict) else None
    if explicit in {'whole', 'written', 'oral', 'component'}:
        return str(explicit)
    if amount == budget:
        return 'whole'
    return 'component'


def compute_credit_accounting(
    program_code: str,
    courses: list[dict[str, Any]],
    regulation_preferences: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Count actual records only: every reported total reconciles to its rows.

    Earliest eligible evidence is the deterministic default, never the best grade.
    Excess records stay visible for the owner to exclude or clarify explicitly.
    """
    policy = get_official_regulation(program_code)
    recorded = sum((_decimal(course.get('ects')) for course in courses), Decimal(0))
    if not policy:
        return {'recordedEcts': float(recorded), 'uniqueEarnedEcts': None,
                'degreeCountedEcts': None, 'gradeCountedEcts': None, 'degreeGrade': None,
                'reviewReasons': [{'achievementId': 'regulation', 'reasons': ['unsupported_regulation']}],
                'courseAccounting': {}}
    definitions = {module['code']: module for group in policy['ruleGroups'] for module in group['modules']}
    module_areas = {module['code']: group['code'] for group in policy['ruleGroups'] for module in group['modules']}
    groups = {group['code']: group for group in policy['ruleGroups']}
    source_modules_by_index = {
        index: _source_module_metadata(course, program_code)
        for index, course in enumerate(courses)
    }
    for index, course in enumerate(courses):
        source_module = source_modules_by_index[index]
        if not source_module:
            continue
        code = str(source_module['moduleCode'])
        area = str(source_module['areaCode'])
        budget = _decimal(source_module.get('moduleBudgetEcts'))
        if area in groups and budget > 0 and code not in definitions:
            definitions[code] = {'code': code, 'name': str(source_module.get('moduleTitle') or code),
                                 'ects': float(budget), 'kind': str(source_module.get('moduleKind') or 'module')}
            module_areas[code] = area
    reasons: dict[int, list[str]] = {}

    def reason(index: int, code: str) -> None:
        if code not in reasons.setdefault(index, []):
            reasons[index].append(code)

    ordered = sorted(enumerate(courses), key=_completion_order)
    module_grade_evidence: set[str] = set()
    source_module_indices: dict[str, list[int]] = {}
    for index, course in enumerate(courses):
        source_module = source_modules_by_index[index]
        if source_module and _safe_text(course.get('studyAreaCode')) == str(source_module.get('areaCode')):
            code = str(source_module['moduleCode'])
            source_module_indices.setdefault(code, []).append(index)
            if course.get('grade') is not None:
                module_grade_evidence.add(code)
    identities: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for index, course in ordered:
        identities.setdefault(achievement_identity(course, program_code), []).append((index, course))
    unique: set[int] = set()
    ambiguous_grades: set[int] = set()
    for records in identities.values():
        # Explicitly excluded evidence must not win over the owner's selected row.
        selected = next(((i, c) for i, c in records if not c.get('isAdditionalAchievement')), records[0])
        unique.add(selected[0])
        included = [(i, c) for i, c in records if not c.get('isAdditionalAchievement')]
        grades = {_decimal(c.get('grade')) if c.get('grade') is not None else None for _, c in included}
        if len(grades) > 1:
            ambiguous_grades.add(selected[0])
            for index, _ in included:
                reason(index, 'duplicate_conflicting_grades')
        for index, _ in records:
            if index != selected[0]:
                reason(index, 'duplicate_achievement')

    accepted: set[int] = set()
    accepted_ects: dict[int, Decimal] = {}
    module_usage: dict[str, Decimal] = {}
    component_usage: dict[tuple[str, str], Decimal] = {}
    area_usage: dict[str, Decimal] = {}
    area_types: dict[tuple[str, str], Decimal] = {}
    area_projects: dict[str, int] = {}
    seminar_count = 0
    row_modules: dict[int, str] = {}
    whole_completions: set[str] = set()
    for index, course in ordered:
        if (index not in unique or course.get('isAdditionalAchievement')
                or course.get('identityNeedsReview') or course.get('assignmentNeedsReview')):
            continue
        module = _module_for_evidence(program_code, course)
        area = _safe_text(course.get('studyAreaCode'))
        evidence = course.get('recognitionEvidence') or {}
        eligible = course.get('allowedAreaCodes')
        if not evidence.get('confirmed') and (
                (isinstance(eligible, list) and area not in eligible)
                or (eligible is None and not module)):
            continue
        if module and area != module_areas.get(module):
            continue
        definition = definitions.get(module or '')
        if definition and definition['kind'] not in {'pool', 'choice'}:
            budget = _decimal(definition['ects'])
            if _completion_kind(course, _decimal(course.get('ects')), budget) == 'whole' and _decimal(course.get('ects')) == budget:
                whole_completions.add(str(module))
        elif area == 'THESIS' and _decimal(course.get('ects')) == _decimal(groups['THESIS']['requiredEcts']):
            whole_completions.add('THESIS')

    for index, course in ordered:
        source_module = source_modules_by_index[index]
        if index not in unique or not source_module or _safe_text(course.get('studyAreaCode')) == 'THESIS':
            continue
        code = str(source_module['moduleCode'])
        definition = definitions.get(code)
        if (code in whole_completions and definition
                and definition['kind'] not in {'pool', 'choice', 'completion'}
                and _decimal(course.get('ects')) < _decimal(definition['ects'])):
            unique.discard(index)
            reason(index, 'module_component_already_included')

    for index, course in ordered:
        if index not in unique:
            continue
        recorded_amount = _decimal(course.get('ects'))
        amount = recorded_amount
        if (isinstance(course.get('recognitionEvidence'), dict)
                and course['recognitionEvidence'].get('confirmed') is True
                and course['recognitionEvidence'].get('countedEcts') is not None):
            amount = _decimal(course['recognitionEvidence'].get('countedEcts'))
        if amount <= 0:
            reason(index, 'missing_or_invalid_credits')
            continue
        if course.get('isAdditionalAchievement'):
            continue
        source_module = source_modules_by_index[index]
        if policy.get('gradedModulesOnly') and course.get('grade') is None:
            source_code = str(source_module['moduleCode']) if source_module else None
            is_source_module = bool(source_module and source_module.get('moduleKind') not in {'pool', 'choice'})
            if not is_source_module or source_code not in module_grade_evidence:
                reason(index, 'graded_module_required')
                continue
        area = _safe_text(course.get('studyAreaCode'))
        recognition = course.get('recognitionEvidence')
        confirmed = isinstance(recognition, dict) and recognition.get('confirmed') is True
        if amount < recorded_amount and area == 'THESIS':
            reason(index, 'thesis_credit_cannot_be_partial')
            continue
        module = _module_for_evidence(program_code, course)
        if confirmed and recognition.get('areaCode') and area != recognition.get('areaCode'):
            reason(index, 'recognition_area_mismatch')
            continue
        definition = definitions.get(module or '')
        if course.get('identityNeedsReview') or course.get('assignmentNeedsReview'):
            reason(index, 'assignment_needs_review')
            continue
        if area not in groups:
            reason(index, 'area_not_in_regulation')
            continue
        if program_code == 'MSC_INFO_2021':
            basis = bool((regulation_preferences or {}).get('mscInfoBasisAdmissionConfirmed'))
            if area == ('INFO-FOKUS' if basis else 'INFO-BASIS'):
                reason(index, 'focus_area_excluded_by_basis_admission' if basis else 'basis_area_requires_admission_declaration')
                continue
        eligible = course.get('allowedAreaCodes')
        if isinstance(eligible, list) and area not in eligible and not confirmed:
            reason(index, 'course_not_eligible_for_area')
            continue
        if groups[area]['groupType'] == 'pflicht' and not definition:
            reason(index, 'compulsory_module_unverified')
            continue
        if module and area != module_areas.get(module) and not confirmed:
            reason(index, 'module_area_mismatch')
            continue
        if not module and not confirmed and not isinstance(eligible, list):
            reason(index, 'course_eligibility_unverified')
            continue
        types = ([str(course['assessmentType'])] if course.get('assessmentType')
                 and not course.get('courseType') else assessment_types(course.get('courseType'), course.get('title')))
        if program_code == 'MSC_ML_2021' and 'hochschulsport' in str(course.get('title') or '').casefold():
            reason(index, 'university_sports_excluded')
            continue
        parent = str(module) if definition and definition['kind'] != 'pool' else None
        budget = _decimal(definition['ects']) if parent else None
        component = None
        if (parent in whole_completions and definition
                and definition['kind'] not in {'pool', 'choice', 'completion'}
                and budget is not None and amount < budget):
            reason(index, 'module_component_already_included')
            unique.discard(index)
            continue
        if area == 'THESIS':
            parent = parent or 'THESIS'
            budget = budget or _decimal(groups['THESIS']['requiredEcts'])
            component = _completion_kind(course, recorded_amount, budget)
            if component == 'component':
                reason(index, 'completion_component_kind_unverified')
                continue
            if parent in whole_completions and component != 'whole':
                reason(index, 'completion_component_already_included')
                unique.discard(index)
                continue
            maximum = {'written': policy['writtenThesisEcts'], 'oral': policy['oralThesisEcts']}.get(component)
            if maximum is not None and component_usage.get((parent, component), Decimal(0)) + amount > _decimal(maximum):
                reason(index, 'completion_component_credit_limit_exceeded')
                continue
        if parent and budget is not None and module_usage.get(parent, Decimal(0)) + amount > budget:
            reason(index, 'alternative_slot_credits_capped' if definition and definition['kind'] == 'choice' else 'module_credit_limit_exceeded')
            continue
        if area == 'UEBK' and program_code == 'BSC_INFO_2021' and area_usage.get(area, Decimal(0)) + amount > Decimal(18):
            reason(index, 'alternative_area_credit_limit_exceeded')
            continue
        limits = policy.get('areaLimits', {}).get(area, {})
        if 'seminar' in types and policy.get('maxSeminars') is not None and seminar_count >= policy['maxSeminars']:
            reason(index, 'seminar_count_limit_exceeded')
            continue
        limited = False
        for kind, limit in (('seminar', 'maxSeminarEcts'), ('practical', 'maxPracticalEcts')):
            if kind in types and limit in limits and area_types.get((area, kind), Decimal(0)) + amount > _decimal(limits[limit]):
                reason(index, kind + '_area_limit_exceeded')
                limited = True
        if 'research_project' in types and 'maxResearchProjects' in limits and area_projects.get(area, 0) >= limits['maxResearchProjects']:
            reason(index, 'area_research_projects_exceeded')
            limited = True
        if limited:
            continue
        area_target = _decimal(groups[area].get('requiredEcts'))
        if area_target > 0 and area_usage.get(area, Decimal(0)) + amount > area_target:
            reason(index, 'area_credit_limit_exceeded')
            continue
        accepted.add(index)
        accepted_ects[index] = amount
        area_usage[area] = area_usage.get(area, Decimal(0)) + amount
        if parent:
            row_modules[index] = parent
            module_usage[parent] = module_usage.get(parent, Decimal(0)) + amount
            if component:
                component_usage[(parent, component)] = component_usage.get((parent, component), Decimal(0)) + amount
        if 'seminar' in types:
            seminar_count += 1
        for kind in ('seminar', 'practical'):
            if kind in types:
                area_types[(area, kind)] = area_types.get((area, kind), Decimal(0)) + amount
        if 'research_project' in types:
            area_projects[area] = area_projects.get(area, 0) + 1

    for code, definition in definitions.items():
        area = module_areas[code]
        if (groups[area]['groupType'] == 'pflicht' and definition['kind'] != 'pool'
                and module_usage.get(code, Decimal(0)) < _decimal(definition['ects'])):
            for index in list(accepted):
                if row_modules.get(index) == code:
                    accepted.remove(index)
                    reason(index, 'required_module_incomplete')
    area_usage = {}
    for index in accepted:
        area = str(courses[index].get('studyAreaCode') or '')
        area_usage[area] = area_usage.get(area, Decimal(0)) + accepted_ects[index]

    module_progress = []
    for group in policy['ruleGroups']:
        if group['groupType'] != 'pflicht' and group['code'] != 'THESIS':
            continue
        requirements = [module for module in group['modules'] if module['kind'] != 'pool']
        if group['code'] == 'THESIS' and not requirements:
            requirements = [{'code': 'THESIS', 'name': group['name'], 'ects': group['requiredEcts']}]
        for module in requirements:
            earned = module_usage.get(module['code'], Decimal(0))
            module_progress.append({'code': module['code'], 'name': module['name'], 'areaCode': group['code'],
                                    'requiredEcts': module['ects'], 'earnedEcts': float(earned),
                                    'isFulfilled': earned >= _decimal(module['ects'])})
    missing_modules = [module['code'] for module in module_progress if not module['isFulfilled']]
    missing_areas = [group['code'] for group in policy['ruleGroups']
                     if not (program_code == 'MSC_INFO_2021' and group['code'] == (
                         'INFO-FOKUS' if (regulation_preferences or {}).get('mscInfoBasisAdmissionConfirmed') else 'INFO-BASIS'))
                     and area_usage.get(group['code'], Decimal(0)) < _decimal(group['requiredEcts'])]
    incomplete_module_grades: set[str] = set()
    for parent in set(row_modules.values()):
        if parent in whole_completions:
            continue
        members = source_module_indices.get(parent, [])
        if (any(courses[index].get('grade') is None for index in members)
                and any(courses[index].get('grade') is not None for index in members)):
            incomplete_module_grades.add(parent)
            for index in accepted:
                if row_modules.get(index) == parent:
                    reason(index, 'module_grade_incomplete')
    grade_rows = {index for index in accepted if index not in ambiguous_grades
                  and row_modules.get(index) not in incomplete_module_grades
                  and courses[index].get('grade') is not None
                  and grade_is_counted(program_code, courses[index].get('studyAreaCode'))}
    grade_values = {index: _decimal(courses[index]['grade']) for index in grade_rows}
    # Framework §19(3): component grades form a module grade at two decimals.
    # A submitted official whole-module grade supersedes the component records.
    for parent in set(row_modules.values()):
        members = [index for index in grade_rows if row_modules.get(index) == parent]
        weight = sum((accepted_ects[index] for index in members), Decimal(0))
        if len(members) > 1 and weight > 0:
            average = sum((grade_values[index] * accepted_ects[index] for index in members), Decimal(0)) / weight
            module_grade = _decimal(truncate_official_grade(average, 2))
            for index in members:
                grade_values[index] = module_grade
    grade_ects = sum((accepted_ects[index] for index in grade_rows), Decimal(0))
    weighted = sum((grade_values[index] * accepted_ects[index] for index in grade_rows), Decimal(0))
    accounting = {
        str(course.get('id') or index): {
            'achievementKey': achievement_identity(course, program_code),
            'earnedEcts': float(_decimal(course.get('ects'))),
            'uniqueEarnedEcts': float(max(Decimal(0), _decimal(course.get('ects')))) if index in unique else 0.0,
            'degreeCountedEcts': float(accepted_ects[index]) if index in accepted else 0.0,
            'gradeCountedEcts': float(accepted_ects[index]) if index in grade_rows else 0.0,
            'gradeUsedForAverage': float(grade_values[index]) if index in grade_rows else None,
            'reviewReasons': reasons.get(index, []),
        }
        for index, course in enumerate(courses)
    }
    review_rows = [{'achievementId': key, 'reasons': row['reviewReasons']} for key, row in accounting.items() if row['reviewReasons']]
    requirements = []
    if missing_modules:
        requirements.append('missing_required_modules:' + ','.join(missing_modules))
    if missing_areas:
        requirements.append('missing_required_areas:' + ','.join(missing_areas))
    additional_ects = sum((_decimal(courses[index].get('ects')) for index in unique
                           if courses[index].get('isAdditionalAchievement')), Decimal(0))
    if policy.get('additionalEctsLimit') is not None and additional_ects > _decimal(policy['additionalEctsLimit']):
        requirements.append('additional_achievement_limit_exceeded')
    if requirements:
        review_rows.append({'achievementId': 'regulation', 'reasons': requirements})
    return {
        'recordedEcts': float(recorded), 'additionalEcts': float(additional_ects),
        'uniqueEarnedEcts': sum(row['uniqueEarnedEcts'] for row in accounting.values()),
        'degreeCountedEcts': sum(row['degreeCountedEcts'] for row in accounting.values()),
        'gradeCountedEcts': float(grade_ects), 'unallocatedDegreeEcts': 0.0,
        'degreeGrade': truncate_official_grade(weighted / grade_ects if grade_ects else None, policy['gradeDecimals']),
        'missingRequiredModules': missing_modules, 'missingRequiredAreas': missing_areas,
        'moduleProgress': module_progress, 'areaCredits': {key: float(value) for key, value in area_usage.items()},
        'reviewReasons': review_rows, 'courseAccounting': accounting,
    }

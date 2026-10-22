"""Verified PO-2021 reference data; legal sources are registered in docs/official-po-sources.json.

Areas are a non-overlapping display allocation, not additional legal credit quotas.
Integrated übK stays in its original module. Pool amounts are never course credits.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_DOWN
from functools import lru_cache
from typing import Any

# Module code -> (title, CP, kind). Shared codes are shared modules, not offerings.
MODULES: dict[str, tuple[str, float, str]] = {
    'INFM1010': ('Mathematik für Informatik 1: Analysis', 9, 'module'),
    'INFM1020': ('Mathematik für Informatik 2: Lineare Algebra', 9, 'module'),
    'INFM2010': ('Mathematik für Informatik 3: Fortgeschrittene Themen', 9, 'module'),
    'INFM2020': ('Mathematik für Informatik 4: Numerik oder Stochastik', 6, 'choice'),
    'INFM1110': ('Praktische Informatik 1: Deklarative Programmierung', 9, 'module'),
    'INFM1120': ('Praktische Informatik 2: Imperative und objektorientierte Programmierung', 9, 'module'),
    'INFM2111': ('Praktische Informatik 3: Software Engineering', 6, 'module'),
    'INFM2110': ('Praktische Informatik 4: Teamprojekt', 9, 'module'),
    'INFM1310': ('Technische Informatik 1: Digitaltechnik', 6, 'module'),
    'INFM2310': ('Technische Informatik 2: Informatik der Systeme', 9, 'module'),
    'INFM2320': ('Technische Informatik 3: Praktikum Mikrocomputer', 6, 'module'),
    'INFM2420': ('Theoretische Informatik 1: Algorithmen und Datenstrukturen', 9, 'module'),
    'INFM2410': ('Theoretische Informatik 2: Formale Sprachen, Berechenbarkeit und Komplexität', 9, 'module'),
    'INFM3151': ('Grundlagen des Maschinellen Lernens', 6, 'module'),
    'INFM1510': ('Proseminar Informatik', 3, 'module'),
    'INFM6110': ('Studium Professionale', 18, 'pool'),
    'INFM1710': ('Schwerpunkt Informatik', 18, 'pool'),
    'INFM3110': ('Wahlpflicht Praktische Informatik', 6, 'pool'),
    'INFM3310': ('Wahlpflicht Technische Informatik', 6, 'pool'),
    'INFM3410': ('Wahlpflicht Theoretische Informatik', 6, 'pool'),
    'INFM2510': ('Wahlpflicht Informatik', 15, 'pool'),
    'INFM3999': ('Abschlussmodul Informatik', 15, 'completion'),
    'BIOINFM1110': ('Einführung in die Bioinformatik', 3, 'module'),
    'BIOINFM2110': ('Grundlagen der Bioinformatik', 9, 'module'),
    'BIOINFM1510': ('Proseminar Bioinformatik', 3, 'module'),
    'BIOINFM1240': ('Zellbiologie, Mikrobiologie und Genetik', 12, 'module'),
    'BIOINFM1210': ('Chemie I', 12, 'module'),
    'BIOINFM1220': ('Chemie II: Physikalische Chemie', 6, 'module'),
    'BIOINFM1230': ('Neurobiologie', 9, 'module'),
    'BIOINFM2021': ('Mathematik für Informatik 4: Stochastik', 6, 'module'),
    'BIOINFM2510': ('Wahlpflicht Informatik', 6, 'pool'),
    'BIOINFM2710': ('Wahlpflicht Lebenswissenschaften', 6, 'pool'),
    'BIOINFM2210': ('Wahlpflicht Bioinformatik', 6, 'pool'),
    'BIOINFM6120': ('Studium Professionale', 9, 'pool'),
    'BIOINFM3999': ('Abschlussmodul Bioinformatik', 15, 'completion'),
    'MEINFM3164': ('User Experience', 6, 'module'),
    'MEINFM3171': ('Einführung in Internettechnologien', 6, 'module'),
    'MEINFM3321': ('Grundlagen der Multimediatechnik', 6, 'module'),
    'MEINFM3000': ('Ethik und Recht in der Medieninformatik', 3, 'module'),
    'MEINFM1510': ('Proseminar Medieninformatik', 3, 'module'),
    'MEINFM3143': ('Bildverarbeitung', 6, 'module'),
    'MEINFM3142': ('Grafische Datenverarbeitung', 9, 'module'),
    'MEINFM3210': ('Wahlpflicht Informatik', 9, 'pool'),
    'MEINFM3220': ('Wahlpflicht Medieninformatik', 12, 'pool'),
    'MEINFM2510': ('Wahlpflicht Medienwissenschaften', 12, 'pool'),
    'MEINFM6120': ('Studium Professionale', 6, 'pool'),
    'MEINFM3999': ('Abschlussmodul Medieninformatik', 15, 'completion'),
    'MDZINFM1410': ('Grundlagen der Medizininformatik', 6, 'module'),
    'MDZINFM1310': ('Medizinische Terminologie und Humanbiologie I', 6, 'module'),
    'MDZINFM1320': ('Humanbiologie II', 6, 'module'),
    'MDZINFM2320': ('Humanbiologie III', 6, 'module'),
    'MDZINFM2330': ('Humanbiologie IV', 6, 'module'),
    'MDZINFM1210': ('Physik I', 6, 'module'),
    'MDZINFM1220': ('Physik II', 6, 'module'),
    'MDZINFM2310': ('Biostatistik', 3, 'module'),
    'MDZINFM1510': ('Proseminar Medizininformatik', 3, 'module'),
    'MDZINFM2430': ('Telemedizin', 6, 'module'),
    'MDZINFM3210': ('Medizinische Visualisierung', 6, 'module'),
    'S06PLQ2': ('Geschichte, Theorie und Ethik der Medizin', 3, 'module'),
    'MDZINFM3510': ('Wahlpflicht Biologie oder Medizin', 6, 'pool'),
    'MDZINFM2510': ('Wahlpflicht Informatik', 6, 'pool'),
    'MDZINFM3110': ('Wahlpflicht Medizinische Informatik oder Bioinformatik', 12, 'pool'),
    'MDZINFM3610': ('Studium Professionale', 6, 'pool'),
    'MDZINFM3999': ('Abschlussmodul Medizininformatik', 15, 'completion'),
}

# code, display title, kind, required CP, module/category codes.
AREA_DEFINITIONS: dict[str, list[tuple[str, str, str, float, str]]] = {
    'BSC_INFO_2021': [
        ('INF', 'Informatik und Mathematik (Pflicht)', 'pflicht', 114, 'INFM1010 INFM1020 INFM2010 INFM2020 INFM1110 INFM1120 INFM2111 INFM2110 INFM1310 INFM2310 INFM2320 INFM2420 INFM2410 INFM3151 INFM1510'),
        ('PRAK', 'Wahlpflicht Praktische Informatik', 'elective_area', 6, 'INFM3110'),
        ('TECH', 'Wahlpflicht Technische Informatik', 'elective_area', 6, 'INFM3310'),
        ('THEO', 'Wahlpflicht Theoretische Informatik', 'elective_area', 6, 'INFM3410'),
        ('INFO', 'Wahlpflicht Informatik', 'elective_area', 15, 'INFM2510'),
        ('UEBK', 'Studium Professionale oder Schwerpunkt', 'elective_area', 18, 'INFM6110 INFM1710'),
        ('THESIS', 'Abschlussmodul', 'abschluss', 15, 'INFM3999'),
    ],
    'BSC_BIOINFO_2021': [
        ('MATH', 'Mathematik (Pflicht)', 'pflicht', 33, 'INFM1010 INFM1020 INFM2010 BIOINFM2021'),
        ('INF', 'Informatik (Pflicht)', 'pflicht', 51, 'INFM1110 INFM1120 INFM2111 INFM2110 INFM2420 INFM2410'),
        ('BIO', 'Bioinformatik (Pflicht)', 'pflicht', 15, 'BIOINFM1110 BIOINFM2110 BIOINFM1510'),
        ('LIFE', 'Lebenswissenschaften (Pflicht)', 'pflicht', 39, 'BIOINFM1240 BIOINFM1210 BIOINFM1220 BIOINFM1230'),
        ('ELECTIVE-INF', 'Wahlpflicht Informatik', 'elective_area', 6, 'BIOINFM2510'),
        ('ELECTIVE-LIFE', 'Wahlpflicht Lebenswissenschaften', 'elective_area', 6, 'BIOINFM2710'),
        ('ELECTIVE-BIO', 'Wahlpflicht Bioinformatik', 'elective_area', 6, 'BIOINFM2210'),
        ('UEBK', 'Studium Professionale', 'elective_area', 9, 'BIOINFM6120'),
        ('THESIS', 'Abschlussmodul', 'abschluss', 15, 'BIOINFM3999'),
    ],
    'BSC_MEDIENINFO_2021': [
        ('MATH', 'Mathematik (Pflicht)', 'pflicht', 27, 'INFM1010 INFM1020 INFM2010'),
        ('INF', 'Informatik (Pflicht)', 'pflicht', 60, 'INFM1110 INFM1120 INFM2310 INFM2420 INFM2111 INFM2410 INFM2110'),
        ('MEDIAINFO', 'Medieninformatik (Pflicht)', 'pflicht', 39, 'MEINFM3164 MEINFM3171 MEINFM3321 MEINFM3000 MEINFM1510 MEINFM3143 MEINFM3142'),
        ('ELECTIVE-INF', 'Wahlpflicht Informatik', 'elective_area', 9, 'MEINFM3210'),
        ('ELECTIVE-MEDIA', 'Wahlpflicht Medieninformatik', 'elective_area', 12, 'MEINFM3220'),
        ('MEDIA_STUDIES', 'Wahlpflicht Medienwissenschaften', 'elective_area', 12, 'MEINFM2510'),
        ('UEBK', 'Studium Professionale', 'elective_area', 6, 'MEINFM6120'),
        ('THESIS', 'Abschlussmodul', 'abschluss', 15, 'MEINFM3999'),
    ],
    'BSC_MEDIZININFO_2021': [
        ('MATH', 'Mathematik und Biostatistik (Pflicht)', 'pflicht', 21, 'INFM1010 INFM1020 MDZINFM2310'),
        ('INF', 'Informatik (Pflicht)', 'pflicht', 45, 'INFM1110 INFM1120 INFM2111 INFM2110 MEINFM3164 MEINFM3171'),
        ('MEDINFO', 'Medizininformatik (Pflicht)', 'pflicht', 30, 'MDZINFM1410 BIOINFM2110 MDZINFM1510 MDZINFM2430 MDZINFM3210'),
        ('MED_BIO_PHYS', 'Medizin, Biologie und Physik (Pflicht)', 'pflicht', 39, 'MDZINFM1310 MDZINFM1320 MDZINFM2320 MDZINFM2330 MDZINFM1210 MDZINFM1220 S06PLQ2'),
        ('ELECTIVE-INF', 'Wahlpflicht Informatik', 'elective_area', 6, 'MDZINFM2510'),
        ('ELECTIVE-BIOMED', 'Wahlpflicht Biologie oder Medizin', 'elective_area', 6, 'MDZINFM3510'),
        ('ELECTIVE-MEDBIO', 'Wahlpflicht Medizinische Informatik oder Bioinformatik', 'elective_area', 12, 'MDZINFM3110'),
        ('UEBK', 'Studium Professionale', 'elective_area', 6, 'MDZINFM3610'),
        ('THESIS', 'Abschlussmodul', 'abschluss', 15, 'MDZINFM3999'),
    ],
    'MSC_INFO_2021': [
        ('INFO-PRAK', 'Praktische Informatik', 'elective_area', 18, ''),
        ('INFO-TECH', 'Technische Informatik', 'elective_area', 18, ''),
        ('INFO-THEO', 'Theoretische Informatik', 'elective_area', 18, ''),
        ('INFO-INFO', 'Informatik', 'elective_area', 18, ''),
        ('INFO-FOKUS', 'Fokus Informatik (Alternative zu BASIS)', 'elective_area', 18, ''),
        ('INFO-BASIS', 'Basis Informatik (nur gemäß Zulassungsbescheid)', 'elective_area', 18, ''),
        ('THESIS', 'Abschlussmodul', 'abschluss', 30, ''),
    ],
    'MSC_ML_2021': [
        ('ML-FOUND', 'Foundations of Machine Learning', 'elective_area', 24, ''),
        ('ML-DIVERSE', 'Diverse Topics in Machine Learning', 'elective_area', 36, ''),
        ('ML-CS', 'General Computer Science', 'elective_area', 18, ''),
        ('ML-EXP', 'Expanded Perspectives', 'elective_area', 12, ''),
        ('THESIS', 'Abschlussmodul', 'abschluss', 30, ''),
    ],
}

SOURCE_FILES = {
    'BSC_INFO_2021': 'PO_Informatik_BSc_BT_2021_10.pdf',
    'BSC_BIOINFO_2021': 'PO_Bioinformatik_BSc_BT_2021_10.pdf',
    'BSC_MEDIENINFO_2021': 'PO_Medieninformatik_BSc_BT_2021_10.pdf',
    'BSC_MEDIZININFO_2021': 'PO_Medizininformatik_BSc_BT_2021_10.pdf',
    'MSC_INFO_2021': 'PO_Informatik_MSc_BT_2021_10.pdf',
    'MSC_ML_2021': 'PO_MachLearn_MSc_BT_2021_10.pdf',
}
SOURCE_BASE = 'https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/'


def module_aliases(code: str) -> list[str]:
    aliases = [code]
    if code.startswith('INFM'):
        aliases.append(code.replace('INFM', 'INF', 1))
    if code == 'INFM1010':
        aliases.append('ModulMath1')
    if code == 'INFM1020':
        aliases.extend(['INF1020-V', 'ModulMath2'])
    if code == 'INFM2010':
        aliases.append('ModulMath3')
    if code == 'INFM2020':
        aliases.extend(['MAT-95-41', 'MAT-95-42'])
    if code == 'INFM2020':
        aliases.append('ModulMath4')
    if code == 'BIOINFM2021':
        aliases.append('MAT-95-42')
    return aliases


def _normalize_identity(value: Any) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize('NFKD', str(value or '').casefold())
    return re.sub(r'[^a-z0-9]+', '', normalized.encode('ascii', 'ignore').decode('ascii'))


@lru_cache(maxsize=6)
def _module_alias_index(program_code: str) -> dict[str, set[str]]:
    index: dict[str, set[str]] = {}
    for *_, codes in AREA_DEFINITIONS[program_code]:
        for code in codes.split():
            for alias in module_aliases(code):
                index.setdefault(_normalize_identity(alias), set()).add(code)
    return index


def canonical_module_code(program_code: str | None, *identifiers: Any) -> str | None:
    """Resolve an ALMA/module alias only when it is unique in the selected PO."""
    if not program_code or program_code not in AREA_DEFINITIONS:
        return None
    index = _module_alias_index(program_code)
    matches = {code for value in identifiers if value
               for code in index.get(_normalize_identity(value), set())}
    return next(iter(matches)) if len(matches) == 1 else None


def assessment_types(course_type: str | None, title: str | None = None) -> list[str]:
    text = f'{course_type or ""} {title or ""}'.casefold()
    categories = (
        ('seminar', ('seminar', 'proseminar')),
        ('practical', ('praktikum', 'practical', 'laboratory', 'lab course')),
        ('research_project', ('forschungsprojekt', 'research project', 'projektarbeit')),
        ('lecture', ('vorlesung', 'lecture')),
        ('exercise', ('übung', 'exercise', 'tutorial')),
        ('exam', ('klausur', 'exam', 'prüfung')),
    )
    return [kind for kind, terms in categories if any(term in text for term in terms)] or ['other']


def assessment_type(course_type: str | None, title: str | None = None) -> str:
    return next((kind for kind in assessment_types(course_type, title)
                 if kind in {'seminar', 'practical', 'research_project'}), 'other')


def assignment_limit_error(program_code: str | None, assignments: list[dict[str, Any]]) -> str | None:
    """Validate only explicit PO-wide and area type caps; unknown type is not guessed."""
    policy = get_official_regulation(program_code)
    if not policy:
        return None
    seminars = [row for row in assignments if row.get('assessmentType') == 'seminar']
    if len(seminars) > int(policy.get('maxSeminars') or 0) and policy.get('maxSeminars') is not None:
        return 'maximum_seminars_exceeded'
    limits = policy.get('areaLimits') or {}
    for area_code, limit in limits.items():
        rows = [row for row in assignments if row.get('areaCode') == area_code]
        seminar_ects = sum(float(row.get('ects') or 0) for row in rows if row.get('assessmentType') == 'seminar')
        practical_ects = sum(float(row.get('ects') or 0) for row in rows if row.get('assessmentType') == 'practical')
        projects = sum(1 for row in rows if row.get('assessmentType') == 'research_project')
        if seminar_ects > float(limit.get('maxSeminarEcts', float('inf'))):
            return 'area_seminar_ects_exceeded'
        if practical_ects > float(limit.get('maxPracticalEcts', float('inf'))):
            return 'area_practical_ects_exceeded'
        if projects > int(limit.get('maxResearchProjects', 2**31)):
            return 'area_research_projects_exceeded'
    return None


def grade_is_counted(program_code: str | None, area_code: str | None, *, assignment_needs_review: bool = False) -> bool:
    if assignment_needs_review or not program_code:
        return False
    policy = get_official_regulation(program_code)
    return bool(policy) and (area_code or '').upper() not in policy['gradeExcludedAreas']


def truncate_official_grade(grade: float | None, decimals: int = 1) -> float | None:
    """Official rules discard excess grade decimals, rather than rounding."""
    if grade is None:
        return None
    factor = Decimal(10) ** decimals
    truncated = (Decimal(str(grade)) * factor).to_integral_value(rounding=ROUND_DOWN) / factor
    return float(truncated)


def primary_course_number(value: Any) -> str:
    import re
    text = str(value or '').strip()
    return re.sub(r'\s*\((?:entspricht|alias|equivalent|gleichwertig)\b.*$', '', text, flags=re.I).strip()


def _assessment_component(course: dict[str, Any]) -> str | None:
    explicit = course.get('assessmentComponent') or course.get('componentKey')
    if explicit:
        return _normalize_identity(str(explicit)) or None
    evidence = course.get('recognitionEvidence')
    if isinstance(evidence, dict) and evidence.get('confirmed') is True:
        component = evidence.get('componentKey') or evidence.get('componentKind')
        if component:
            return _normalize_identity(str(component)) or None
    title = str(course.get('title') or '').casefold()
    if any(token in title for token in ('kolloquium', 'colloquium', 'mündlich', 'oral')):
        return 'oral'
    if any(token in title for token in ('schriftlich', 'written', 'thesisarbeit', 'abschlussarbeit', 'bachelorarbeit', 'masterarbeit')):
        return 'written'
    return None


def achievement_identity(course: dict[str, Any], program_code: str) -> str:
    """Identify the assessment, while its curriculum parent has a separate budget."""
    import re

    raw_number = primary_course_number(course.get('courseNumber') or course.get('externalCourseCode'))
    source_module = _source_module_metadata(course, program_code, scope_area=False)
    module_code = (str(source_module['moduleCode']) if source_module
                   else canonical_module_code(program_code, course.get('moduleCode'), raw_number))
    if not module_code:
        # Fixed assessment aliases remain the same when used in a master's BASIS.
        candidates = {canonical_module_code(code, course.get('moduleCode'), raw_number)
                      for code in AREA_DEFINITIONS if code.startswith('BSC_')}
        candidates.discard(None)
        fixed = {code for code in candidates if MODULES[code][2] not in {'pool', 'choice'}}
        if len(fixed) == 1:
            module_code = next(iter(fixed))
    evidence = course.get('recognitionEvidence')
    explicit_component = (
        _safe_text(course.get('assessmentComponent'))
        or (_safe_text(evidence.get('componentKey')) if isinstance(evidence, dict)
            and evidence.get('confirmed') is True else None)
    )
    component = explicit_component or _assessment_component(course)
    repeatable = any(kind in assessment_types(course.get('courseType'), course.get('title'))
                     for kind in ('seminar', 'research_project'))
    if module_code and source_module and not repeatable:
        budget = _decimal(source_module.get('moduleBudgetEcts'))
        amount = _decimal(course.get('ects'))
        if budget > 0 and (amount == 0 or amount >= budget) and not explicit_component:
            return f'module:{module_code}:whole'
    if module_code and component:
        return f'assessment:{module_code}:{_normalize_identity(component)}'
    if isinstance(evidence, dict) and evidence.get('confirmed') is True and evidence.get('componentKey'):
        return f"recognition:{_safe_text(evidence.get('areaCode')) or 'unassigned'}:{_normalize_identity(evidence['componentKey'])}"
    title = re.sub(r'\((?:entspricht|alias|equivalent|gleichwertig)\b[^)]*\)', '', str(course.get('title') or ''), flags=re.I)
    if raw_number:
        title = re.sub(r'^(?:' + re.escape(raw_number) + r'\s*)+', '', title, flags=re.I)
    title = _normalize_identity(title)
    repeatable = any(kind in assessment_types(course.get('courseType'), course.get('title'))
                     for kind in ('seminar', 'research_project'))
    module_definition = MODULES.get(module_code or '')
    if module_code and (module_definition or source_module):
        module_kind = module_definition[2] if module_definition else str(source_module.get('moduleKind') or '')
        module_budget = _decimal(module_definition[1] if module_definition else source_module.get('moduleBudgetEcts'))
        if module_kind == 'pool':
            module_budget = Decimal(0)
        aliases = {_normalize_identity(alias) for alias in module_aliases(module_code)} if module_definition else set()
        number = _normalize_identity(raw_number)
        if module_kind == 'choice':
            branch = {'mat9541': 'numerik', 'mat9542': 'stochastik'}.get(number)
            if not branch:
                branch = next((name for name in ('numerik', 'stochastik') if name in title), None)
            return f'assessment:{module_code}:{branch or number or title or "whole"}'
        if repeatable:
            return f'assessment:{module_code}:{number}:{title}'
        if not raw_number or number in aliases or source_module:
            amount = _decimal(course.get('ects'))
            explicit_component_key = _safe_text(course.get('componentKey')) or _safe_text((course.get('creditMetadata') or {}).get('componentKey'))
            if explicit_component_key and amount < module_budget:
                return f'assessment:{module_code}:component:{_normalize_identity(explicit_component_key)}'
            if amount > 0 and amount < module_budget and title:
                return f'assessment:{module_code}:component:{title}'
            return f'module:{module_code}:whole'
        return f'assessment:{module_code}:{number}'
    if raw_number:
        number = _normalize_identity(raw_number)
        return f'course:{number}:{title}' if repeatable or (module_definition and module_definition[2] == 'pool') else f'course:{number}'
    return f'assessment:{module_code or "unmapped"}:{title}' if title else 'unresolved:identity'


def find_duplicate_achievements(courses: list[dict[str, Any]], program_code: str) -> list[list[str]]:
    grouped: dict[str, list[str]] = {}
    for index, course in enumerate(courses):
        grouped.setdefault(achievement_identity(course, program_code), []).append(
            str(course.get('id') or index)
        )
    return [ids for ids in grouped.values() if len(ids) > 1]




def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _decimal(value: Any) -> Decimal:
    try:
        result = Decimal(str(value or 0))
        return result if result.is_finite() else Decimal(0)
    except Exception:
        return Decimal(0)


def _source_module_metadata(
    course: dict[str, Any], program_code: str, *, scope_area: bool = True,
) -> dict[str, Any] | None:
    metadata = course.get('creditMetadata') or {}
    modules = [module for program in metadata.get('programs', [])
               if program.get('programCode') == program_code
               for module in program.get('modules', [])
               if module.get('moduleCode') and module.get('moduleKind') != 'pool'
               and (not scope_area or not course.get('studyAreaCode')
                    or module.get('areaCode') == course.get('studyAreaCode'))]
    unique = {str(module['moduleCode']): module for module in modules}
    return next(iter(unique.values())) if len(unique) == 1 else None


def _module_for_evidence(program_code: str, course: dict[str, Any]) -> str | None:
    evidence = course.get('recognitionEvidence')
    if isinstance(evidence, dict) and evidence.get('confirmed') is True:
        candidate = str(evidence.get('moduleCode') or '')
        if candidate in MODULES and any(candidate in group.split() for *_, group in AREA_DEFINITIONS[program_code]):
            return candidate
    source_module = _source_module_metadata(course, program_code)
    if source_module:
        return str(source_module['moduleCode'])
    return canonical_module_code(
        program_code, course.get('moduleCode'), course.get('courseNumber'),
        course.get('externalCourseCode'), course.get('title'),
    )




@lru_cache(maxsize=8)
def get_official_regulation(code: str | None) -> dict[str, Any] | None:
    # Catalog serialization reuses immutable reference data hundreds of times.
    if code not in AREA_DEFINITIONS:
        return None
    groups = []
    for index, (area, name, kind, credits, modules) in enumerate(AREA_DEFINITIONS[code]):
        definitions = [
            {
                'code': module, 'name': MODULES[module][0],
                'ects': None if MODULES[module][2] == 'pool' else MODULES[module][1],
                'quotaEcts': MODULES[module][1] if MODULES[module][2] == 'pool' else None,
                'kind': MODULES[module][2], 'aliases': module_aliases(module),
            }
            for module in modules.split()
        ]
        groups.append({
            'code': area, 'name': name, 'groupType': kind, 'requiredEcts': credits,
            'sortOrder': (index + 1) * 10, 'modules': definitions,
        })
    policy: dict[str, Any] = {
        'programCode': code, 'revision': '2026-10',
        'totalEcts': 180 if code.startswith('BSC_') else 120,
        'gradeDecimals': 1, 'moduleGradeDecimals': 2, 'degreeGradeDecimals': 1, 'gradeExcludedAreas': ['ML-EXP'] if code == 'MSC_ML_2021' else [],
        'ruleGroups': groups,
        'sourceSection': '§5; §16' if code != 'MSC_ML_2021' else '§5; §15; 2026 amendment §5(4), §7',
        'signedOn': '2021-03-25', 'firstApplies': 'WS 2021/22',
        'alternativeAreas': [['INFO-FOKUS', 'INFO-BASIS']] if code == 'MSC_INFO_2021' else
                            [['INFM2020 (Numerik)', 'INFM2020 (Stochastik)']] if code == 'BSC_INFO_2021' else [],
        'conditionalAreas': ['INFO-BASIS'] if code == 'MSC_INFO_2021' else [],
        'masterOnlyAreas': ['INFO-PRAK', 'INFO-TECH', 'INFO-THEO', 'INFO-INFO', 'INFO-FOKUS'] if code == 'MSC_INFO_2021' else [],
        'bachelorElectiveOnlyAreas': ['ML-CS'] if code == 'MSC_ML_2021' else [],
        'areaEligibilityRules': (
            {'ML-CS': {'acceptedPrograms': ['BSC_INFO_2021', 'MSC_INFO_2021'],
                       'bachelorAreaTypes': ['elective_area'], 'masterLevel': True}}
            if code == 'MSC_ML_2021' else
            {'INFO-FOKUS': {'moduleLevel': 'master'},
             'INFO-BASIS': {'preferenceKey': 'mscInfoBasisAdmissionConfirmed', 'requiredValue': True}}
            if code == 'MSC_INFO_2021' else {}
        ),
        'areaLimits': (
            {'INFO-INFO': {'maxResearchProjects': 1}} if code == 'MSC_INFO_2021' else
            {'ML-DIVERSE': {'maxSeminarEcts': 6, 'maxPracticalEcts': 6}} if code == 'MSC_ML_2021' else {}
        ),
        'gradeRequirement': 'graded_modules_only' if code == 'MSC_ML_2021' else None,

        'modules': [
            {'code': module_code, 'name': title,
             'ects': None if kind == 'pool' else ects,
             'quotaEcts': ects if kind == 'pool' else None,
             'kind': kind, 'aliases': module_aliases(module_code)}
            for module_code, (title, ects, kind) in MODULES.items()
            if any(module_code in group.split() for _, _, _, _, group in AREA_DEFINITIONS[code])
        ],
        'sourceUrl': SOURCE_BASE + 'PO_BSc_MSc_MA/' + SOURCE_FILES[code],
    }
    if code.startswith('MSC_'):
        policy.update(maxSeminars=3, additionalEctsLimit=30, writtenThesisEcts=27, oralThesisEcts=3)
    else:
        policy.update(writtenThesisEcts=12, oralThesisEcts=3)
    if code == 'MSC_INFO_2021':
        policy.update(
            admissionDecisionRequired=True,
            conditionalAreaDeclaration={
                'preferenceKey': 'mscInfoBasisAdmissionConfirmed',
                'trueArea': 'INFO-BASIS', 'falseArea': 'INFO-FOKUS',
            },
        )
    if code == 'MSC_ML_2021':
        policy.update(
            gradedModulesOnly=True,
            amendmentUrl=SOURCE_BASE + 'PO_Aenderungssatzungen/AendS_PO_ML_MSc_BT_1AendS_2026_01.pdf',
        )
    return policy


def compute_credit_accounting(
    program_code: str,
    courses: list[dict[str, Any]],
    regulation_preferences: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # Keep the existing service entrypoint while separating evaluation from PO data.
    from services.regulation_credits import compute_credit_accounting as evaluate
    return evaluate(program_code, courses, regulation_preferences)

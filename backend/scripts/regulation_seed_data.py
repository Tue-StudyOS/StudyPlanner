from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.official_regulations import get_official_regulation

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_DIR = REPO_ROOT / 'einzupflegene_po'
OFFICIAL_SOURCE_STATUS = 'official'
SQLITE_RULE_GROUP_PROGRAM_CODES = {'BSC_INFO_2021', 'MSC_INFO_2021', 'MSC_ML_2021'}
PO_VERSION_PATTERN = re.compile(r'(\d{4})')


@dataclass(frozen=True)
class SourceProgramSpec:
    filename: str
    study_program_id: int
    code: str
    regulation_code: str
    subject: str
    language: str | None
    uses_sqlite_rule_groups: bool


@dataclass(frozen=True)
class RuleGroupSeed:
    code: str
    name: str
    required_ects: float | None
    sort_order: int
    notes: str | None


@dataclass(frozen=True)
class ProgramSeed:
    study_program_id: int
    code: str
    regulation_code: str
    name: str
    regulation_name: str
    degree: str
    subject: str
    po_version: str
    total_ects: float
    language: str | None
    source_status: str
    notes: str | None
    version_label: str
    uses_sqlite_rule_groups: bool
    rule_groups: tuple[RuleGroupSeed, ...]


PROGRAM_SPECS: tuple[SourceProgramSpec, ...] = (
    SourceProgramSpec(
        filename='bsc_informatik_po2021.json',
        study_program_id=1,
        code='BSC_INFO_2021',
        regulation_code='BSC_INFO',
        subject='Informatik',
        language='de',
        uses_sqlite_rule_groups=True,
    ),
    SourceProgramSpec(
        filename='msc_informatik_po2021.json',
        study_program_id=2,
        code='MSC_INFO_2021',
        regulation_code='MSC_INFO',
        subject='Informatik / Computer Science',
        language='de',
        uses_sqlite_rule_groups=True,
    ),
    SourceProgramSpec(
        filename='msc_machine_learning_po2021.json',
        study_program_id=3,
        code='MSC_ML_2021',
        regulation_code='MSC_ML',
        subject='Maschinelles Lernen / Machine Learning',
        language='en',
        uses_sqlite_rule_groups=True,
    ),
    SourceProgramSpec(
        filename='bsc_bioinformatik_po2021.json',
        study_program_id=4,
        code='BSC_BIOINFO_2021',
        regulation_code='BSC_BIOINFO',
        subject='Bioinformatik',
        language='de',
        uses_sqlite_rule_groups=False,
    ),
    SourceProgramSpec(
        filename='bsc_medieninformatik_po2021.json',
        study_program_id=5,
        code='BSC_MEDIENINFO_2021',
        regulation_code='BSC_MEDIENINFO',
        subject='Medieninformatik',
        language='de',
        uses_sqlite_rule_groups=False,
    ),
    SourceProgramSpec(
        filename='bsc_medizininformatik_po2021.json',
        study_program_id=6,
        code='BSC_MEDIZININFO_2021',
        regulation_code='BSC_MEDIZININFO',
        subject='Medizininformatik',
        language='de',
        uses_sqlite_rule_groups=False,
    ),
)


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


def _normalize_identifier(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value)
    ascii_value = normalized.encode('ascii', 'ignore').decode('ascii')
    return ascii_value.lower()


def _slugify_rule_group_code(value: str) -> str:
    normalized = _normalize_identifier(value)
    collapsed = re.sub(r'[^a-z0-9]+', '_', normalized).strip('_').upper()
    return collapsed[:48] or 'AREA'


def _derive_rule_group_code(area_name: str) -> str:
    normalized_name = _normalize_identifier(area_name)
    if 'foundations of machine learning' in normalized_name and 'empfohlene' not in normalized_name:
        return 'ML_FOUND'
    if 'empfohlene erganzung' in normalized_name:
        return 'ML_FOUND_EXT'
    if 'diverse topics in machine learning' in normalized_name:
        return 'ML_TOPICS'
    if 'general computer science' in normalized_name:
        return 'ML_CS'
    if 'expanded perspectives' in normalized_name:
        return 'ML_EXP'
    if 'praktikum und seminar' in normalized_name:
        return 'PRAK_SEM'
    if 'mathematik' in normalized_name:
        return 'MATH'
    if 'bioinformatik' in normalized_name:
        return 'BIOINFO'
    if 'medizininformatik' in normalized_name:
        return 'MEDINFO'
    if 'medieninformatik' in normalized_name:
        return 'MEDIAINFO'
    if 'medienwissenschaft' in normalized_name:
        return 'MEDIA_STUDIES'
    if 'lebenswissenschaft' in normalized_name:
        return 'LIFE'
    if 'medizin, biologie und physik' in normalized_name:
        return 'MED_BIO_PHYS'
    if 'uberfachliche' in normalized_name or 'ubk' in normalized_name:
        return 'UEBK'
    if 'wahlpflicht informatik' in normalized_name:
        return 'INFO_ELECTIVE'
    if 'wahlpflicht' in normalized_name:
        return 'ELECTIVE'
    if 'schwerpunkt / anwendungsfach' in normalized_name:
        return 'SPECIALIZATION'
    if 'schwerpunkt' in normalized_name:
        return 'SPECIALIZATION'
    if 'pflichtbereich' in normalized_name:
        return 'REQUIRED'
    if 'abschluss' in normalized_name:
        return 'THESIS'
    if 'informatik' in normalized_name:
        return 'INF'
    return _slugify_rule_group_code(area_name)


def _derive_required_ects(area: dict[str, Any]) -> float | None:
    explicit_total = _normalize_float(area.get('gesamt_ects_bereich'))
    if explicit_total is not None:
        return explicit_total

    normalized_area_name = _normalize_identifier(_safe_text(area.get('bereich')) or '')
    if 'kein pflicht' in normalized_area_name:
        return None

    total_ects = 0.0
    found_numeric_value = False
    for module_entry in area.get('module', []):
        module_ects = _normalize_float(module_entry.get('ects'))
        if module_ects is None:
            module_ects = _normalize_float(module_entry.get('ects_min'))
        if module_ects is None:
            continue
        total_ects += module_ects
        found_numeric_value = True

    return total_ects if found_numeric_value else None


def _build_program_notes(payload: dict[str, Any]) -> str | None:
    note_parts: list[str] = []
    po_date = _safe_text(payload.get('po_datum'))
    if po_date:
        note_parts.append(f'PO publication date: {po_date}.')

    regular_duration = payload.get('regelstudienzeit_semester')
    if regular_duration not in {None, ''}:
        note_parts.append(f'Regular duration: {regular_duration} semesters.')

    source_url = _safe_text(payload.get('quelle'))
    if source_url:
        note_parts.append(f'Source: {source_url}.')

    admission_note = _safe_text(payload.get('zulassung_hinweis'))
    if admission_note:
        note_parts.append(admission_note)

    return ' '.join(note_parts) or None


def _parse_po_version(payload: dict[str, Any]) -> str:
    po_value = _safe_text(payload.get('pruefungsordnung')) or ''
    match = PO_VERSION_PATTERN.search(po_value)
    return match.group(1) if match else po_value or '2021'


def _build_rule_groups(payload: dict[str, Any]) -> tuple[RuleGroupSeed, ...]:
    rule_groups: list[RuleGroupSeed] = []
    for index, area in enumerate(payload.get('module', []), start=1):
        area_name = _safe_text(area.get('bereich')) or f'Area {index}'
        rule_groups.append(
            RuleGroupSeed(
                code=_derive_rule_group_code(area_name),
                name=area_name,
                required_ects=_derive_required_ects(area),
                sort_order=index * 10,
                notes=_safe_text(area.get('hinweis')),
            )
        )
    return tuple(rule_groups)


def load_program_seeds(source_dir: Path = DEFAULT_SOURCE_DIR) -> list[ProgramSeed]:
    program_seeds: list[ProgramSeed] = []
    for program_spec in PROGRAM_SPECS:
        source_path = source_dir / program_spec.filename
        if not source_path.exists():
            raise FileNotFoundError(f'Program definition not found: {source_path}')

        with source_path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)

        official = get_official_regulation(program_spec.code)
        if official is None:
            raise ValueError(f'No verified PO data for {program_spec.code}')
        po_version = '2021'
        degree = _safe_text(payload.get('abschluss')) or 'Unknown degree'
        total_ects = float(official['totalEcts'])
        regulation_name = f'{degree} {program_spec.subject}'
        program_seeds.append(
            ProgramSeed(
                study_program_id=program_spec.study_program_id,
                code=program_spec.code,
                regulation_code=program_spec.regulation_code,
                name=f'{regulation_name} (PO {po_version})',
                regulation_name=regulation_name,
                degree=degree,
                subject=program_spec.subject,
                po_version=po_version,
                total_ects=total_ects,
                language=program_spec.language,
                source_status=OFFICIAL_SOURCE_STATUS,
                notes=(f"Official special part PO 2021, §5; source: {official['sourceUrl']}"),
                version_label=po_version,
                uses_sqlite_rule_groups=False,
                rule_groups=tuple(
                    RuleGroupSeed(group['code'], group['name'], group['requiredEcts'],
                                  group['sortOrder'], group.get('sourceSection'))
                    for group in official['ruleGroups']
                ),
            )
        )

    return program_seeds

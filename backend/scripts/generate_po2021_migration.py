from __future__ import annotations

import sqlite3
from pathlib import Path

from regulation_seed_data import SQLITE_RULE_GROUP_PROGRAM_CODES, load_program_seeds

ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / 'migrations' / '0010_seed_official_po2021_programs.sql'


def quote(sqlite_conn: sqlite3.Connection, value: object) -> str:
    row = sqlite_conn.execute('SELECT quote(?)', (value,)).fetchone()
    return str(row[0]) if row else 'NULL'


def sql_string_list(values: set[str]) -> str:
    return ', '.join(f"'{value}'" for value in sorted(values))


def build_migration_sql() -> str:
    sqlite_conn = sqlite3.connect(':memory:')
    try:
        lines: list[str] = [
            'PRAGMA foreign_keys = ON;',
            '',
            '-- Seed official PO 2021 study-program metadata from einzupflegene_po/.',
        ]
        program_seeds = load_program_seeds()

        for program_seed in program_seeds:
            values = ', '.join(
                [
                    quote(sqlite_conn, program_seed.study_program_id),
                    quote(sqlite_conn, program_seed.code),
                    quote(sqlite_conn, program_seed.name),
                    quote(sqlite_conn, program_seed.degree),
                    quote(sqlite_conn, program_seed.subject),
                    quote(sqlite_conn, program_seed.po_version),
                    quote(sqlite_conn, program_seed.total_ects),
                    quote(sqlite_conn, program_seed.language),
                    quote(sqlite_conn, program_seed.source_status),
                    quote(sqlite_conn, program_seed.notes),
                ]
            )
            lines.extend(
                [
                    'INSERT INTO study_programs (',
                    '    id,',
                    '    code,',
                    '    name,',
                    '    degree,',
                    '    subject,',
                    '    po_version,',
                    '    total_ects,',
                    '    language,',
                    '    source_status,',
                    '    notes',
                    f') VALUES ({values})',
                    'ON CONFLICT(code) DO UPDATE SET',
                    '    name = excluded.name,',
                    '    degree = excluded.degree,',
                    '    subject = excluded.subject,',
                    '    po_version = excluded.po_version,',
                    '    total_ects = excluded.total_ects,',
                    '    language = excluded.language,',
                    '    source_status = excluded.source_status,',
                    '    notes = excluded.notes;',
                    '',
                ]
            )

        for program_seed in program_seeds:
            values = ', '.join(
                [
                    quote(sqlite_conn, program_seed.regulation_code),
                    quote(sqlite_conn, program_seed.regulation_name),
                    quote(sqlite_conn, program_seed.degree),
                    quote(sqlite_conn, program_seed.subject),
                    quote(sqlite_conn, program_seed.notes),
                ]
            )
            lines.extend(
                [
                    'INSERT INTO examination_regulations (',
                    '    code,',
                    '    name,',
                    '    degree,',
                    '    subject,',
                    '    notes',
                    f') VALUES ({values})',
                    'ON CONFLICT(code) DO UPDATE SET',
                    '    name = excluded.name,',
                    '    degree = excluded.degree,',
                    '    subject = excluded.subject,',
                    '    notes = excluded.notes;',
                    '',
                ]
            )

        for program_seed in program_seeds:
            lines.extend(
                [
                    'INSERT INTO regulation_versions (',
                    '    regulation_id,',
                    '    code,',
                    '    version_label,',
                    '    total_ects,',
                    '    language,',
                    '    source_status,',
                    '    notes',
                    ')',
                    'SELECT',
                    '    id,',
                    f'    {quote(sqlite_conn, program_seed.code)},',
                    f'    {quote(sqlite_conn, program_seed.version_label)},',
                    f'    {quote(sqlite_conn, program_seed.total_ects)},',
                    f'    {quote(sqlite_conn, program_seed.language)},',
                    f'    {quote(sqlite_conn, program_seed.source_status)},',
                    f'    {quote(sqlite_conn, program_seed.notes)}',
                    'FROM examination_regulations',
                    f'WHERE code = {quote(sqlite_conn, program_seed.regulation_code)}',
                    'ON CONFLICT(code) DO UPDATE SET',
                    '    version_label = excluded.version_label,',
                    '    total_ects = excluded.total_ects,',
                    '    language = excluded.language,',
                    '    source_status = excluded.source_status,',
                    '    notes = excluded.notes;',
                    '',
                ]
            )

        for program_seed in program_seeds:
            lines.extend(
                [
                    'INSERT INTO study_program_regulation_versions (',
                    '    study_program_id,',
                    '    regulation_version_id,',
                    '    is_default,',
                    '    enrollment_match',
                    ')',
                    'SELECT',
                    '    sp.id,',
                    '    rv.id,',
                    '    1,',
                    "    'program_code'",
                    'FROM study_programs AS sp',
                    'JOIN regulation_versions AS rv',
                    f'    ON rv.code = {quote(sqlite_conn, program_seed.code)}',
                    f'WHERE sp.code = {quote(sqlite_conn, program_seed.code)}',
                    'ON CONFLICT(study_program_id, regulation_version_id) DO UPDATE SET',
                    '    is_default = excluded.is_default,',
                    '    enrollment_match = excluded.enrollment_match;',
                    '',
                ]
            )

        sqlite_program_codes = sql_string_list(SQLITE_RULE_GROUP_PROGRAM_CODES)
        lines.extend(
            [
                '-- Rebuild regulation rule groups and course mappings for the programs that already have curriculum matches.',
                'INSERT OR IGNORE INTO regulation_rule_groups (',
                '    regulation_version_id,',
                '    study_area_id,',
                '    code,',
                '    name,',
                '    group_type,',
                '    required_ects,',
                '    min_ects,',
                '    max_ects,',
                '    sort_order,',
                '    notes',
                ')',
                'SELECT',
                '    rv.id,',
                '    sa.id,',
                '    sa.code,',
                '    sa.name,',
                "    COALESCE(sa.area_type, 'study_area'),",
                '    sa.required_ects,',
                '    sa.min_ects,',
                '    sa.max_ects,',
                '    sa.sort_order,',
                '    sa.source_note',
                'FROM study_areas AS sa',
                'JOIN study_programs AS sp ON sp.id = sa.program_id',
                'JOIN regulation_versions AS rv ON rv.code = sp.code',
                f'WHERE sp.code IN ({sqlite_program_codes});',
                '',
                'INSERT OR IGNORE INTO regulation_course_mappings (',
                '    regulation_version_id,',
                '    course_id,',
                '    module_id,',
                '    rule_group_id,',
                '    status,',
                '    ects_counted,',
                '    match_type,',
                '    source_note',
                ')',
                'SELECT DISTINCT',
                '    rv.id,',
                '    m.course_id,',
                '    m.module_id,',
                '    rrg.id,',
                "    COALESCE(opt.status, 'allowed'),",
                '    COALESCE(opt.ects_counted, cm.ects),',
                '    m.match_type,',
                '    COALESCE(opt.rule_text, m.notes)',
                'FROM course_curriculum_matches AS m',
                'JOIN curriculum_modules AS cm ON cm.id = m.module_id',
                'JOIN module_study_area_options AS opt ON opt.module_id = cm.id',
                'JOIN study_areas AS sa ON sa.id = opt.study_area_id',
                'JOIN study_programs AS sp ON sp.id = sa.program_id',
                'JOIN regulation_versions AS rv ON rv.code = sp.code',
                'JOIN regulation_rule_groups AS rrg',
                '    ON rrg.regulation_version_id = rv.id',
                '   AND rrg.study_area_id = sa.id',
                f'WHERE sp.code IN ({sqlite_program_codes});',
                '',
                '-- BSC_INFO_2021 study_areas were seeded with NULL required_ects.',
                '-- Set correct values derived from the official Prüfungsordnung 2021.',
                'UPDATE regulation_rule_groups',
                'SET required_ects = CASE code',
                "    WHEN 'MATH'  THEN 33",
                "    WHEN 'INF'   THEN 78",
                "    WHEN 'PRAK'  THEN 6",
                "    WHEN 'TECH'  THEN 6",
                "    WHEN 'THEO'  THEN 6",
                "    WHEN 'INFO'  THEN 15",
                "    WHEN 'UEBK'  THEN 18",
                '    ELSE required_ects',
                'END',
                "WHERE regulation_version_id = (",
                "    SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021'",
                ');',
                '',
                '-- Seed rule groups for the additional PO 2021 programs that are only backed by JSON for now.',
            ]
        )

        for program_seed in program_seeds:
            if program_seed.uses_sqlite_rule_groups:
                continue

            for rule_group in program_seed.rule_groups:
                lines.extend(
                    [
                        'INSERT INTO regulation_rule_groups (',
                        '    regulation_version_id,',
                        '    study_area_id,',
                        '    code,',
                        '    name,',
                        '    group_type,',
                        '    required_ects,',
                        '    min_ects,',
                        '    max_ects,',
                        '    sort_order,',
                        '    notes',
                        ')',
                        'SELECT',
                        '    rv.id,',
                        '    NULL,',
                        f'    {quote(sqlite_conn, rule_group.code)},',
                        f'    {quote(sqlite_conn, rule_group.name)},',
                        "    'study_area',",
                        f'    {quote(sqlite_conn, rule_group.required_ects)},',
                        '    NULL,',
                        '    NULL,',
                        f'    {quote(sqlite_conn, rule_group.sort_order)},',
                        f'    {quote(sqlite_conn, rule_group.notes)}',
                        'FROM regulation_versions AS rv',
                        f'WHERE rv.code = {quote(sqlite_conn, program_seed.code)}',
                        'ON CONFLICT(regulation_version_id, code) DO UPDATE SET',
                        '    name = excluded.name,',
                        '    group_type = excluded.group_type,',
                        '    required_ects = excluded.required_ects,',
                        '    sort_order = excluded.sort_order,',
                        '    notes = excluded.notes;',
                        '',
                    ]
                )

        return '\n'.join(lines)
    finally:
        sqlite_conn.close()


def main() -> None:
    OUTPUT_PATH.write_text(build_migration_sql(), encoding='utf-8')
    print(f'Wrote migration: {OUTPUT_PATH}')


if __name__ == '__main__':
    main()

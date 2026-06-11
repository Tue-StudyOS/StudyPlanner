"""Validate the period-aware catalog SQL against the generated seed file.

Builds an in-memory SQLite database from migrations 0001 + 0020 plus
backend/data/seed_alma_catalog.sql, then runs the same statements the
course_catalog service sends to D1. Use this after regenerating the seed to
confirm period ids/labels survive the import and that curriculum links are
rebuilt from the scraped category codes.

The deployed DB gets its study_areas / curriculum_modules from the legacy
alma.sqlite export, not from migrations, so a small fixture mirroring the
production codes is inserted before the seed runs.
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
INITIAL_MIGRATION = ROOT_DIR / "migrations" / "0001_initial.sql"
LINKS_MIGRATION = ROOT_DIR / "migrations" / "0020_course_study_area_links.sql"
SEED_FILE = ROOT_DIR / "data" / "seed_alma_catalog.sql"

CATALOG_FILTER_SQL = """
    (
        c.organisation LIKE '%Fachbereich Informatik%'
        OR c.number LIKE 'INF%'
        OR c.number LIKE 'INFO%'
        OR c.number LIKE 'INFM%'
        OR c.number LIKE 'INFL%'
    )
"""
PERIOD_LABEL_SQL = "COALESCE(json_extract(c.raw_json, '$.period_label'), c.period_id)"

# Mirrors the study-area codes seeded in production via the legacy export.
FIXTURE_SQL = """
INSERT INTO study_programs (id, code, name) VALUES
    (1, 'MSC_INFO_2021', 'Informatik M.Sc. PO 2021'),
    (2, 'MSC_ML_2021', 'Machine Learning M.Sc. PO 2021');
INSERT INTO study_areas (program_id, code, name, sort_order) VALUES
    (1, 'INFO-PRAK', 'Praktische Informatik', 1),
    (1, 'INFO-TECH', 'Technische Informatik', 2),
    (1, 'INFO-THEO', 'Theoretische Informatik', 3),
    (1, 'INFO-INFO', 'Vertiefung Informatik', 4),
    (1, 'INFO-FOKUS', 'Fokus Informatik', 5),
    (1, 'INFO-BASIS', 'Grundlagen der Informatik', 6),
    (2, 'ML-FOUND', 'Foundations of Machine Learning', 1),
    (2, 'ML-DIVERSE', 'Diverse Topics of Machine Learning', 2),
    (2, 'ML-CS', 'General Computer Science', 3),
    (2, 'ML-EXP', 'Expanded Perspectives', 4);
INSERT INTO curriculum_modules (module_code, title, ects) VALUES
    ('INF2410', 'Theoretische Informatik 2', 9.0);
"""


def build_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    # D1 has unixepoch() built in; the local SQLite bundled with older Python
    # versions does not, and the schema uses it in DEFAULT expressions.
    connection.create_function("unixepoch", 0, lambda: int(time.time()))
    connection.executescript(INITIAL_MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(LINKS_MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(FIXTURE_SQL)
    connection.executescript(SEED_FILE.read_text(encoding="utf-8"))
    return connection


def list_periods(connection: sqlite3.Connection) -> list[tuple[str, str, int]]:
    rows = connection.execute(
        f"""
        SELECT
            c.period_id,
            MAX({PERIOD_LABEL_SQL}),
            COUNT(*)
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
        GROUP BY c.period_id
        """
    ).fetchall()
    return [(str(row[0]), str(row[1]), int(row[2])) for row in rows]


def count_courses_in_period(connection: sqlite3.Connection, period_id: str) -> int:
    row = connection.execute(
        f"""
        SELECT COUNT(*), MIN({PERIOD_LABEL_SQL})
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
          AND c.period_id = ?
        """,
        (period_id,),
    ).fetchone()
    print(f"period {period_id} ({row[1]}): {row[0]} catalog courses")
    return int(row[0])


def check_curriculum_links(connection: sqlite3.Connection) -> None:
    """Every period must produce study-area links and module matches."""
    (link_count,) = connection.execute(
        "SELECT COUNT(*) FROM course_study_area_links"
    ).fetchone()
    (match_count,) = connection.execute(
        "SELECT COUNT(*) FROM course_curriculum_matches"
    ).fetchone()
    print(f"curriculum links: {link_count} study-area links, {match_count} module matches")
    if link_count == 0:
        raise SystemExit("No course_study_area_links built - check the seed rebuild SQL.")
    if match_count == 0:
        raise SystemExit("No course_curriculum_matches built - check the seed rebuild SQL.")

    periods_without_links = connection.execute(
        f"""
        SELECT c.period_id, COUNT(l.id)
        FROM courses AS c
        LEFT JOIN course_study_area_links AS l ON l.course_id = c.id
        GROUP BY c.period_id
        HAVING COUNT(l.id) = 0
        """
    ).fetchall()
    if periods_without_links:
        raise SystemExit(
            f"Periods without any study-area links: {[row[0] for row in periods_without_links]}"
        )

    mismatched = connection.execute(
        """
        SELECT COUNT(*)
        FROM course_study_area_links AS l
        JOIN course_fields AS f ON f.course_id = l.course_id AND f."key" = '_categories_json'
        JOIN study_areas AS sa ON sa.id = l.study_area_id
        WHERE instr(f.value, '"' || l.source_code || '"') = 0
        """
    ).fetchone()[0]
    if mismatched:
        raise SystemExit(f"{mismatched} links whose source_code is not in the course categories.")


def main() -> None:
    connection = build_database()
    periods = list_periods(connection)
    if not periods:
        raise SystemExit("No periods found in the seeded catalog - check the seed file.")

    print(f"{len(periods)} periods in catalog:")
    for period_id, label, course_count in periods:
        print(f"  {period_id}: {label} ({course_count} courses)")

    unlabeled = [period_id for period_id, label, _ in periods if label == period_id]
    if unlabeled:
        raise SystemExit(f"Periods without a label in raw_json: {unlabeled}")

    for period_id, _, expected_count in periods:
        actual_count = count_courses_in_period(connection, period_id)
        if actual_count != expected_count:
            raise SystemExit(
                f"Period filter mismatch for {period_id}: {actual_count} != {expected_count}"
            )

    check_curriculum_links(connection)
    print("OK: period labels, period filter, and curriculum links are consistent.")


if __name__ == "__main__":
    main()

"""Validate the period-aware catalog SQL against the generated seed file.

Builds an in-memory SQLite database from migration 0001 plus
backend/data/seed_alma_catalog.sql, then runs the same statements the
course_catalog service sends to D1. Use this after regenerating the seed to
confirm period ids/labels survive the import.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
INITIAL_MIGRATION = ROOT_DIR / "migrations" / "0001_initial.sql"
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


def build_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.executescript(INITIAL_MIGRATION.read_text(encoding="utf-8"))
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

    print("OK: period labels present and period filter is consistent.")


if __name__ == "__main__":
    main()

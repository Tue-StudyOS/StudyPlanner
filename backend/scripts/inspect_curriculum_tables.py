"""Inspect curriculum-match tables in a local catalog SQLite file.

Diagnostic helper for the curriculum-match gap: prints row counts, match
types, and sample matches so we can compare the legacy single-period
``alma.sqlite`` against what the multi-period import pipeline produces.

Usage:
    python inspect_curriculum_tables.py [path-to-sqlite]
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_PATH = ROOT_DIR / "data" / "alma.sqlite"


def print_table_counts(conn: sqlite3.Connection) -> None:
    tables = [
        "courses",
        "curriculum_modules",
        "course_curriculum_matches",
        "module_study_area_options",
        "study_areas",
        "study_programs",
    ]
    print("== row counts ==")
    for table in tables:
        try:
            (count,) = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        except sqlite3.OperationalError as error:
            print(f"  {table}: <missing> ({error})")
            continue
        print(f"  {table}: {count}")


def print_match_breakdown(conn: sqlite3.Connection) -> None:
    print("== match types ==")
    rows = conn.execute(
        "SELECT match_type, COUNT(*) FROM course_curriculum_matches GROUP BY match_type"
    ).fetchall()
    for match_type, count in rows:
        print(f"  {match_type}: {count}")


def print_sample_matches(conn: sqlite3.Connection, limit: int = 10) -> None:
    print(f"== sample matches (first {limit}) ==")
    rows = conn.execute(
        """
        SELECT c.number, c.title, cm.module_code, cm.title, m.match_type
        FROM course_curriculum_matches AS m
        JOIN courses AS c ON c.id = m.course_id
        JOIN curriculum_modules AS cm ON cm.id = m.module_id
        ORDER BY m.id
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    for number, course_title, module_code, module_title, match_type in rows:
        print(f"  [{match_type}] {number} {course_title!r} -> {module_code} {module_title!r}")


def main() -> None:
    sqlite_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SQLITE_PATH
    if not sqlite_path.is_file():
        raise SystemExit(f"SQLite file not found: {sqlite_path}")
    conn = sqlite3.connect(sqlite_path)
    try:
        print(f"Inspecting {sqlite_path}")
        print_table_counts(conn)
        print_match_breakdown(conn)
        print_sample_matches(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

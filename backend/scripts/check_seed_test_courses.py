"""Validate scripts/seed_test_courses.sql against the production schema.

Builds an in-memory SQLite database with the same tables as the active D1
(studyplanner-db), seeds two fake catalog periods, applies the seed script
twice (idempotency check), and asserts the rows the catalog API queries
would read. Run from backend/:

    python scripts/check_seed_test_courses.py
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SEED_SQL_PATH = SCRIPT_DIR / "seed_test_courses.sql"

# Mirrors the CREATE TABLE statements of the active D1 (reduced to the tables
# the seed script touches; regulation_versions only exists for the FK).
SCHEMA_SQL = """
CREATE TABLE scrape_runs (
    id INTEGER PRIMARY KEY,
    source_url TEXT NOT NULL,
    branch_title TEXT,
    latest_versions_only INTEGER NOT NULL DEFAULT 1,
    partial INTEGER NOT NULL DEFAULT 0,
    fetched_at_unix INTEGER,
    finished_at_unix INTEGER,
    raw_source_json TEXT NOT NULL,
    imported_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE catalog_nodes (
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    parent_node_id TEXT,
    level INTEGER NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    permalink TEXT,
    detail_url TEXT,
    unit_id TEXT,
    period_id TEXT,
    expandable INTEGER NOT NULL DEFAULT 0,
    expanded INTEGER NOT NULL DEFAULT 0,
    catalog_path TEXT,
    path_titles_json TEXT NOT NULL DEFAULT '[]',
    raw_schedule_json TEXT NOT NULL DEFAULT '[]',
    raw_json TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id),
    FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE
);
CREATE TABLE study_programs (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    degree TEXT,
    subject TEXT,
    po_version TEXT,
    total_ects REAL,
    language TEXT,
    source_status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT
);
CREATE TABLE study_areas (
    id INTEGER PRIMARY KEY,
    program_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    required_ects REAL,
    min_ects REAL,
    max_ects REAL,
    area_type TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    source_note TEXT,
    UNIQUE (program_id, code),
    FOREIGN KEY (program_id) REFERENCES study_programs(id) ON DELETE CASCADE
);
CREATE TABLE curriculum_modules (
    id INTEGER PRIMARY KEY,
    module_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    ects REAL,
    module_type TEXT,
    level TEXT,
    language TEXT,
    frequency TEXT,
    exam_form TEXT,
    source_note TEXT,
    raw_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE module_study_area_options (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL,
    study_area_id INTEGER NOT NULL,
    ects_counted REAL,
    status TEXT NOT NULL DEFAULT 'allowed',
    rule_text TEXT,
    source_note TEXT,
    UNIQUE (module_id, study_area_id, status),
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE CASCADE,
    FOREIGN KEY (study_area_id) REFERENCES study_areas(id) ON DELETE CASCADE
);
CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    period_id TEXT NOT NULL,
    title TEXT NOT NULL,
    number TEXT,
    catalog_title TEXT NOT NULL,
    organisation TEXT,
    course_type TEXT,
    offering_frequency TEXT,
    registration_period TEXT,
    short_comment TEXT,
    semester_hours REAL,
    detail_url TEXT,
    detail_page_url TEXT,
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, unit_id, period_id, detail_url),
    FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, node_id) REFERENCES catalog_nodes(run_id, node_id) ON DELETE CASCADE
);
CREATE TABLE parallel_groups (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    title TEXT,
    group_type TEXT,
    language TEXT,
    responsible_text TEXT,
    max_participants INTEGER,
    min_participants INTEGER,
    semester_hours REAL,
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_json TEXT NOT NULL,
    UNIQUE (course_id, position),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY,
    parallel_group_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    rhythm TEXT,
    weekday TEXT,
    weekday_index INTEGER,
    time_text TEXT,
    start_time TEXT,
    end_time TEXT,
    time_note TEXT,
    date_text TEXT,
    starts_on TEXT,
    ends_on TEXT,
    room_text TEXT,
    instructors_text,
    expected_participants INTEGER,
    note TEXT,
    cancellation_text TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (parallel_group_id, position),
    FOREIGN KEY (parallel_group_id) REFERENCES parallel_groups(id) ON DELETE CASCADE
);
CREATE TABLE course_curriculum_matches (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL,
    match_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    notes TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (course_id, module_id, match_type),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE CASCADE
);
CREATE TABLE regulation_versions (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE
);
CREATE TABLE progress_categories (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    reference_ects REAL NOT NULL,
    color_token TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE course_progress_category_mappings (
    id INTEGER PRIMARY KEY,
    progress_category_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    regulation_version_id INTEGER,
    weight REAL NOT NULL DEFAULT 1.0,
    source_note TEXT,
    UNIQUE (progress_category_id, course_id, regulation_version_id),
    FOREIGN KEY (progress_category_id) REFERENCES progress_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE CASCADE
);
"""

PROGRESS_CATEGORY_CODES = [
    "AI_ML", "CLOUD_DEV", "DATA_DATABASES", "HCI_UX", "MATHEMATICS",
    "ROBOTICS", "SOFTWARE_ENG", "SYSTEMS_SECURITY", "THEORY", "VISION",
]

FIXTURE_SQL = """
INSERT INTO scrape_runs (id, source_url, raw_source_json) VALUES (1, 'https://alma.example/real', '{}');
INSERT INTO catalog_nodes (run_id, node_id, level, title, kind, raw_json)
VALUES (1, 'real-root', 0, 'Real Catalog', 'catalog', '{}');
INSERT INTO courses (run_id, node_id, unit_id, period_id, title, number, catalog_title, raw_json)
VALUES
    (1, 'real-root', 'REAL-1', '229', 'Real Course Summer', 'INFO4711', 'Real Course Summer',
     '{"period_label": "Sommer 2026"}'),
    (1, 'real-root', 'REAL-2', '236', 'Real Course Winter', 'INFO4712', 'Real Course Winter',
     '{"period_label": "Winter 2025/26"}');
"""

EXPECTED_PERIODS = 2
EXPECTED_COURSES = 8 * EXPECTED_PERIODS
EXPECTED_PARALLEL_GROUPS = (8 + 2) * EXPECTED_PERIODS
EXPECTED_APPOINTMENTS = 10 * EXPECTED_PERIODS
EXPECTED_MATCHES = (2 + 3 + 2 + 2 + 3 + 3 + 1 + 3) * EXPECTED_PERIODS
EXPECTED_PROGRESS_MAPPINGS = (2 + 3 + 2 + 3 + 3 + 3 + 3 + 3) * EXPECTED_PERIODS

EXPECTED_MASTER_CATS = {
    "INFO0001-TEST": {"TECH", "PRAK"},
    "INFO0002-TEST": {"INFO", "PRAK", "TECH"},
    "INFO0003-TEST": {"THEO", "PRAK"},
    "INFO0004-TEST": {"INFO", "BASIS"},
    "INFO0005-TEST": {"THEO", "BASIS", "INFO"},
    "INFO0006-TEST": {"INFO", "TECH", "THEO"},
    "INFO0007-TEST": {"PRAK"},
    "INFO0008-TEST": {"TECH", "INFO", "THEO"},
}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def main() -> None:
    seed_sql = SEED_SQL_PATH.read_text(encoding="utf-8")
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA_SQL)
    connection.executescript(FIXTURE_SQL)
    for index, code in enumerate(PROGRESS_CATEGORY_CODES):
        connection.execute(
            "INSERT INTO progress_categories (code, name, reference_ects, sort_order) VALUES (?, ?, 12, ?)",
            (code, code.replace("_", " ").title(), index),
        )

    # Apply twice: the second run must be a no-op (idempotency).
    connection.executescript(seed_sql)
    counts_first = snapshot_counts(connection)
    connection.executescript(seed_sql)
    counts_second = snapshot_counts(connection)
    if counts_first != counts_second:
        fail(f"seed script is not idempotent: {counts_first} != {counts_second}")

    expected = {
        "courses": EXPECTED_COURSES,
        "parallel_groups": EXPECTED_PARALLEL_GROUPS,
        "appointments": EXPECTED_APPOINTMENTS,
        "matches": EXPECTED_MATCHES,
        "progress_mappings": EXPECTED_PROGRESS_MAPPINGS,
    }
    if counts_first != expected:
        fail(f"unexpected row counts: {counts_first} (expected {expected})")

    # Every test course in every period must expose at least one weekly slot
    # the planner can parse (weekday + "HH:MM - HH:MM").
    rows = connection.execute(
        """
        SELECT c.number, c.period_id, a.weekday, a.time_text
        FROM appointments a
        JOIN parallel_groups pg ON pg.id = a.parallel_group_id
        JOIN courses c ON c.id = pg.course_id
        WHERE c.number LIKE '%-TEST'
        """
    ).fetchall()
    slots_by_course_period: dict[tuple[str, str], int] = {}
    for number, period_id, weekday, time_text in rows:
        if weekday not in {"Mon", "Tue", "Wed", "Thu", "Fri"}:
            fail(f"unexpected weekday {weekday!r} for {number}")
        if " - " not in (time_text or ""):
            fail(f"unparseable time_text {time_text!r} for {number}")
        slots_by_course_period[(number, period_id)] = slots_by_course_period.get((number, period_id), 0) + 1
    if len(slots_by_course_period) != EXPECTED_COURSES:
        fail(f"not every course/period has appointments: {len(slots_by_course_period)}")

    # Master categories as derived by the catalog API option query.
    option_rows = connection.execute(
        """
        SELECT c.number, sa.code
        FROM course_curriculum_matches m
        JOIN courses c ON c.id = m.course_id
        JOIN curriculum_modules cm ON cm.id = m.module_id
        LEFT JOIN module_study_area_options opt ON opt.module_id = cm.id
        LEFT JOIN study_areas sa ON sa.id = opt.study_area_id
        WHERE c.number LIKE '%-TEST' AND c.period_id = '229'
        """
    ).fetchall()
    cats_by_course: dict[str, set[str]] = {}
    for number, area_code in option_rows:
        if area_code is None:
            fail(f"module without study-area option for {number}")
        cats_by_course.setdefault(number, set()).add(area_code.replace("TEST-", ""))
    if cats_by_course != EXPECTED_MASTER_CATS:
        fail(f"master category mismatch: {cats_by_course}")

    # Period labels must be readable the same way the API reads them.
    labels = connection.execute(
        """
        SELECT DISTINCT json_extract(raw_json, '$.period_label')
        FROM courses WHERE number LIKE '%-TEST'
        """
    ).fetchall()
    if {row[0] for row in labels} != {"Sommer 2026", "Winter 2025/26"}:
        fail(f"unexpected period labels: {labels}")

    # Cleanup path: deleting the test scrape run must cascade everything.
    connection.execute("DELETE FROM scrape_runs WHERE source_url = 'test://testdata/multi-tag-catalog-2025'")
    leftovers = connection.execute("SELECT COUNT(*) FROM courses WHERE number LIKE '%-TEST'").fetchone()[0]
    appointments_left = connection.execute(
        """
        SELECT COUNT(*) FROM appointments a
        JOIN parallel_groups pg ON pg.id = a.parallel_group_id
        JOIN courses c ON c.id = pg.course_id
        WHERE c.number LIKE '%-TEST'
        """
    ).fetchone()[0]
    if leftovers != 0 or appointments_left != 0:
        fail(f"cascade cleanup left rows behind: courses={leftovers} appointments={appointments_left}")

    print("OK: seed script is idempotent, schema-compatible, and fully removable")
    print(f"    per-period rows: 8 courses, 10 parallel groups, 10 appointments")
    print(f"    totals for {EXPECTED_PERIODS} fixture periods: {counts_first}")


def snapshot_counts(connection: sqlite3.Connection) -> dict[str, int]:
    def count(sql: str) -> int:
        return connection.execute(sql).fetchone()[0]

    return {
        "courses": count("SELECT COUNT(*) FROM courses WHERE number LIKE '%-TEST'"),
        "parallel_groups": count(
            "SELECT COUNT(*) FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id WHERE c.number LIKE '%-TEST'"
        ),
        "appointments": count(
            """
            SELECT COUNT(*) FROM appointments a
            JOIN parallel_groups pg ON pg.id = a.parallel_group_id
            JOIN courses c ON c.id = pg.course_id
            WHERE c.number LIKE '%-TEST'
            """
        ),
        "matches": count(
            "SELECT COUNT(*) FROM course_curriculum_matches m JOIN courses c ON c.id = m.course_id WHERE c.number LIKE '%-TEST'"
        ),
        "progress_mappings": count(
            "SELECT COUNT(*) FROM course_progress_category_mappings p JOIN courses c ON c.id = p.course_id WHERE c.number LIKE '%-TEST'"
        ),
    }


if __name__ == "__main__":
    main()

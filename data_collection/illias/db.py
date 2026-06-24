from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .models import CourseMatch, IliasCourse


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS illias_scrape_runs (
    id INTEGER PRIMARY KEY,
    source_url TEXT NOT NULL,
    fetched_at_unix INTEGER NOT NULL,
    raw_source_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS illias_courses (
    id INTEGER PRIMARY KEY,
    ref_id TEXT NOT NULL UNIQUE,
    run_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    object_type TEXT,
    description TEXT,
    availability TEXT,
    registration TEXT,
    deadline TEXT,
    max_participants INTEGER,
    tags_json TEXT NOT NULL DEFAULT '[]',
    instructors_json TEXT NOT NULL DEFAULT '[]',
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_text TEXT NOT NULL DEFAULT '',
    imported_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (run_id) REFERENCES illias_scrape_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS illias_course_fields (
    course_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (course_id, key),
    FOREIGN KEY (course_id) REFERENCES illias_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS illias_alma_matches (
    illias_course_id INTEGER PRIMARY KEY,
    alma_course_id INTEGER,
    confidence REAL NOT NULL,
    match_type TEXT NOT NULL,
    notes TEXT NOT NULL,
    candidate_count INTEGER NOT NULL,
    matched_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (illias_course_id) REFERENCES illias_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_illias_courses_title ON illias_courses(title);
CREATE INDEX IF NOT EXISTS idx_illias_alma_matches_alma ON illias_alma_matches(alma_course_id);
"""


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA_SQL)
    connection.commit()


def import_scrape(connection: sqlite3.Connection, payload: dict[str, Any]) -> int:
    initialize_database(connection)
    source = payload.get("source") or {}
    fetched_at_unix = int(source.get("fetched_at_unix") or time.time())
    cursor = connection.execute(
        """
        INSERT INTO illias_scrape_runs (source_url, fetched_at_unix, raw_source_json)
        VALUES (?, ?, ?)
        """,
        (
            str(source.get("start_url") or ""),
            fetched_at_unix,
            json.dumps(source, ensure_ascii=False),
        ),
    )
    run_id = int(cursor.lastrowid)
    for raw_course in payload.get("courses") or []:
        course = _course_from_mapping(raw_course)
        row = connection.execute(
            """
            INSERT INTO illias_courses (
                ref_id, run_id, title, url, object_type, description, availability,
                registration, deadline, max_participants, tags_json, instructors_json,
                raw_fields_json, raw_text
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ref_id) DO UPDATE SET
                run_id = excluded.run_id,
                title = excluded.title,
                url = excluded.url,
                object_type = excluded.object_type,
                description = excluded.description,
                availability = excluded.availability,
                registration = excluded.registration,
                deadline = excluded.deadline,
                max_participants = excluded.max_participants,
                tags_json = excluded.tags_json,
                instructors_json = excluded.instructors_json,
                raw_fields_json = excluded.raw_fields_json,
                raw_text = excluded.raw_text,
                imported_at_unix = unixepoch()
            RETURNING id
            """,
            (
                course.ref_id,
                run_id,
                course.title,
                course.url,
                course.object_type,
                course.description,
                course.availability,
                course.registration,
                course.deadline,
                course.max_participants,
                json.dumps(course.tags, ensure_ascii=False),
                json.dumps(course.instructors, ensure_ascii=False),
                json.dumps(course.fields, ensure_ascii=False),
                course.raw_text,
            ),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Failed to upsert ILIAS course {course.ref_id!r}.")
        course_id = int(row["id"])
        connection.execute("DELETE FROM illias_course_fields WHERE course_id = ?", (course_id,))
        connection.executemany(
            """
            INSERT INTO illias_course_fields (course_id, key, value)
            VALUES (?, ?, ?)
            """,
            [(course_id, key, value) for key, value in course.fields.items()],
        )
    connection.commit()
    return run_id


def load_illias_courses(connection: sqlite3.Connection) -> list[IliasCourse]:
    initialize_database(connection)
    latest_run = connection.execute("SELECT MAX(id) AS run_id FROM illias_scrape_runs").fetchone()
    latest_run_id = latest_run["run_id"] if latest_run else None
    if latest_run_id is None:
        return []
    rows = connection.execute(
        """
        SELECT ref_id, title, url, object_type, description, availability,
               registration, deadline, max_participants, tags_json,
               instructors_json, raw_fields_json, raw_text
        FROM illias_courses
        WHERE run_id = ?
        ORDER BY title
        """,
        (latest_run_id,),
    ).fetchall()
    return [_course_from_row(row) for row in rows]


def save_matches(connection: sqlite3.Connection, matches: list[CourseMatch]) -> None:
    initialize_database(connection)
    connection.execute("DELETE FROM illias_alma_matches")
    ref_id_rows = connection.execute("SELECT id, ref_id FROM illias_courses").fetchall()
    course_ids_by_ref_id = {row["ref_id"]: int(row["id"]) for row in ref_id_rows}
    missing_ref_ids = sorted(
        {
            match.illias_course_ref_id
            for match in matches
            if match.illias_course_ref_id not in course_ids_by_ref_id
        }
    )
    if missing_ref_ids:
        raise ValueError(f"Cannot save matches for unknown ILIAS courses: {', '.join(missing_ref_ids)}")
    connection.executemany(
        """
        INSERT OR REPLACE INTO illias_alma_matches (
            illias_course_id, alma_course_id, confidence, match_type,
            notes, candidate_count
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                course_ids_by_ref_id[match.illias_course_ref_id],
                match.alma_course_id,
                match.confidence,
                match.match_type,
                match.notes,
                match.candidate_count,
            )
            for match in matches
        ],
    )
    connection.commit()


def _course_from_mapping(raw: dict[str, Any]) -> IliasCourse:
    return IliasCourse(
        ref_id=str(raw.get("ref_id") or ""),
        title=str(raw.get("title") or ""),
        url=str(raw.get("url") or ""),
        object_type=raw.get("object_type"),
        description=raw.get("description"),
        instructors=[str(item) for item in raw.get("instructors") or []],
        availability=raw.get("availability"),
        registration=raw.get("registration"),
        deadline=raw.get("deadline"),
        max_participants=raw.get("max_participants"),
        tags=[str(item) for item in raw.get("tags") or []],
        fields={str(key): str(value) for key, value in (raw.get("fields") or {}).items()},
        raw_text=str(raw.get("raw_text") or ""),
    )


def _course_from_row(row: sqlite3.Row) -> IliasCourse:
    return IliasCourse(
        ref_id=row["ref_id"],
        title=row["title"],
        url=row["url"],
        object_type=row["object_type"],
        description=row["description"],
        instructors=json.loads(row["instructors_json"] or "[]"),
        availability=row["availability"],
        registration=row["registration"],
        deadline=row["deadline"],
        max_participants=row["max_participants"],
        tags=json.loads(row["tags_json"] or "[]"),
        fields=json.loads(row["raw_fields_json"] or "{}"),
        raw_text=row["raw_text"],
    )

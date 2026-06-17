"""Generate D1 seed SQL for matched public Moodle course metadata.

Input is the `moodle_matches.json` produced by:

    python -m data_collection.moodle.cli --match-sqlite backend/data/alma.sqlite

The generated SQL clears previous Moodle scrape/link rows, inserts the new
snapshot, records all match decisions, and publishes only accepted matches to
course_learning_links.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable, TextIO


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT_DIR.parent / "data_collection" / "output" / "moodle_matches.json"
DEFAULT_OUT_SQL = ROOT_DIR / "data" / "seed_moodle_links.sql"
DEFAULT_RUN_ID = 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Path to moodle_matches.json (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--out-sql",
        type=Path,
        default=DEFAULT_OUT_SQL,
        help=f"Where to write the generated seed SQL (default: {DEFAULT_OUT_SQL})",
    )
    parser.add_argument(
        "--run-id",
        type=int,
        default=DEFAULT_RUN_ID,
        help="Deterministic moodle_scrape_runs.id used by the seed SQL.",
    )
    return parser


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    text = str(value)
    return "'" + text.replace("'", "''") + "'"


def insert_statement(table: str, columns: list[str], values: list[object]) -> str:
    column_list = ", ".join(f'"{column}"' for column in columns)
    value_list = ", ".join(sql_literal(value) for value in values)
    return f'INSERT INTO "{table}" ({column_list}) VALUES ({value_list});'


SCRAPE_RUN_COLUMNS = [
    "id",
    "source_url",
    "category_id",
    "category_title",
    "fetched_at_unix",
    "finished_at_unix",
    "page_count",
    "course_count",
    "raw_json",
]
MOODLE_COURSE_COLUMNS = [
    "id",
    "run_id",
    "moodle_course_id",
    "category_id",
    "title",
    "normalized_title",
    "course_url",
    "enrol_url",
    "summary_text",
    "summary_html",
    "teachers_json",
    "detected_codes_json",
    "detected_terms_json",
    "self_enrol_available",
    "guest_access",
    "limit_mentioned",
    "limit_text",
    "participant_limit_value",
    "raw_json",
]
MOODLE_MATCH_COLUMNS = [
    "id",
    "moodle_course_row_id",
    "course_id",
    "course_number",
    "period_id",
    "match_method",
    "confidence",
    "status",
    "evidence_json",
]
LEARNING_LINK_COLUMNS = [
    "course_id",
    "platform",
    "external_id",
    "url",
    "label",
    "source",
    "confidence",
    "matched_by",
    "fetched_at_unix",
]


def build_seed_rows(payload: dict[str, Any], run_id: int) -> dict[str, list[dict[str, Any]] | dict[str, Any]]:
    source = payload.get("source") or {}
    courses = list(payload.get("courses") or [])
    matches = list(payload.get("matches") or [])
    course_row_id_by_moodle_id: dict[str, int] = {}

    scrape_run = {
        "id": run_id,
        "source_url": source.get("category_url") or source.get("source_url") or "",
        "category_id": source.get("category_id") or "",
        "category_title": source.get("category_title"),
        "fetched_at_unix": int(source.get("fetched_at_unix") or 0),
        "finished_at_unix": source.get("finished_at_unix"),
        "page_count": int(source.get("page_count") or 0),
        "course_count": int(source.get("course_count") or len(courses)),
        "raw_json": json.dumps(source, ensure_ascii=False),
    }

    course_rows: list[dict[str, Any]] = []
    for index, course in enumerate(courses, start=1):
        moodle_course_id = str(course.get("moodle_course_id") or "")
        course_row_id_by_moodle_id[moodle_course_id] = index
        course_rows.append(
            {
                "id": index,
                "run_id": run_id,
                "moodle_course_id": moodle_course_id,
                "category_id": course.get("category_id") or source.get("category_id") or "",
                "title": course.get("title") or "",
                "normalized_title": course.get("normalized_title") or "",
                "course_url": course.get("course_url") or "",
                "enrol_url": course.get("enrol_url"),
                "summary_text": course.get("summary_text"),
                "summary_html": course.get("summary_html"),
                "teachers_json": json.dumps(course.get("teachers") or [], ensure_ascii=False),
                "detected_codes_json": json.dumps(course.get("detected_codes") or [], ensure_ascii=False),
                "detected_terms_json": json.dumps(course.get("detected_terms") or [], ensure_ascii=False),
                "self_enrol_available": course.get("self_enrol_available"),
                "guest_access": course.get("guest_access"),
                "limit_mentioned": 1 if course.get("limit_mentioned") else 0,
                "limit_text": course.get("limit_text"),
                "participant_limit_value": course.get("participant_limit_value"),
                "raw_json": json.dumps(course.get("raw_json") or {}, ensure_ascii=False),
            }
        )

    match_rows: list[dict[str, Any]] = []
    learning_link_rows: list[dict[str, Any]] = []
    for index, match in enumerate(matches, start=1):
        moodle_course_id = str(match.get("moodle_course_id") or "")
        moodle_course_row_id = course_row_id_by_moodle_id.get(moodle_course_id)
        if moodle_course_row_id is None:
            continue
        match_rows.append(
            {
                "id": index,
                "moodle_course_row_id": moodle_course_row_id,
                "course_id": match.get("course_id"),
                "course_number": match.get("course_number"),
                "period_id": match.get("period_id"),
                "match_method": match.get("match_method") or "unknown",
                "confidence": float(match.get("confidence") or 0),
                "status": match.get("status") or "candidate",
                "evidence_json": json.dumps(match.get("evidence") or {}, ensure_ascii=False),
            }
        )
        if match.get("status") != "accepted" or match.get("course_id") is None:
            continue
        course = next(
            (item for item in courses if str(item.get("moodle_course_id") or "") == moodle_course_id),
            None,
        )
        if not course:
            continue
        learning_link_rows.append(
            {
                "course_id": match["course_id"],
                "platform": "moodle",
                "external_id": moodle_course_id,
                "url": course.get("course_url") or "",
                "label": course.get("title") or "Open Moodle course",
                "source": "moodle_category_scrape",
                "confidence": float(match.get("confidence") or 0),
                "matched_by": match.get("match_method"),
                "fetched_at_unix": source.get("fetched_at_unix"),
            }
        )

    return {
        "scrape_run": scrape_run,
        "courses": course_rows,
        "matches": match_rows,
        "learning_links": learning_link_rows,
    }


def write_seed_sql(out_path: Path, rows: dict[str, Any]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        handle.write("-- Generated by backend/scripts/import_moodle_json_to_d1.py\n")
        handle.write("PRAGMA foreign_keys = OFF;\n\n")
        handle.write("DELETE FROM course_learning_links WHERE source = 'moodle_category_scrape';\n")
        handle.write("DELETE FROM moodle_course_matches;\n")
        handle.write("DELETE FROM moodle_courses;\n")
        handle.write("DELETE FROM moodle_scrape_runs;\n\n")
        scrape_run = rows["scrape_run"]
        handle.write(
            insert_statement(
                "moodle_scrape_runs",
                SCRAPE_RUN_COLUMNS,
                [scrape_run.get(column) for column in SCRAPE_RUN_COLUMNS],
            )
            + "\n\n"
        )
        _write_rows(handle, "moodle_courses", MOODLE_COURSE_COLUMNS, rows["courses"])
        _write_rows(handle, "moodle_course_matches", MOODLE_MATCH_COLUMNS, rows["matches"])
        _write_rows(
            handle,
            "course_learning_links",
            LEARNING_LINK_COLUMNS,
            rows["learning_links"],
        )
        handle.write("PRAGMA foreign_keys = ON;\n")


def _write_rows(
    handle: TextIO,
    table: str,
    columns: list[str],
    rows: Iterable[dict[str, Any]],
) -> None:
    rows = list(rows)
    if not rows:
        handle.write(f"-- (no rows for {table})\n\n")
        return
    handle.write(f"-- {table}: {len(rows)} rows\n")
    for row in rows:
        handle.write(
            insert_statement(table, columns, [row.get(column) for column in columns])
            + "\n"
        )
    handle.write("\n")


def main() -> None:
    args = build_parser().parse_args()
    if not args.input.exists():
        raise SystemExit(f"Input JSON not found: {args.input}")
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    rows = build_seed_rows(payload, args.run_id)
    write_seed_sql(args.out_sql, rows)
    print(
        f"Wrote {len(rows['courses'])} Moodle courses, "
        f"{len(rows['matches'])} match rows, and "
        f"{len(rows['learning_links'])} accepted links to {args.out_sql}"
    )


if __name__ == "__main__":
    main()

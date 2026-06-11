"""Push a scraped ALMA `courses_multi_semester.json` into a fresh Cloudflare D1.

Pipeline (each step is opt-in via --apply or skippable individually):

  1. Generate a single seed SQL file from the JSON (always).
  2. `wrangler d1 create <db-name>` -> new database id.
  3. `wrangler d1 migrations apply <db-name> --remote` -> all 17 migrations.
  4. `wrangler d1 execute <db-name> --remote --file <seed.sql>` -> catalog rows.
  5. Update backend/wrangler.toml binding to the new database id.

The old D1 is left intact. Delete it manually after verifying the new one.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

ROOT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT_DIR.parent
DEFAULT_INPUT = REPO_ROOT / "data_collection" / "output" / "2026-06-03_18-31-59" / "courses_multi_semester.json"
DEFAULT_OUT_SQL = ROOT_DIR / "data" / "seed_alma_catalog.sql"
DEFAULT_WRANGLER_TOML = ROOT_DIR / "wrangler.toml"
DEFAULT_DB_NAME = "studyplanner-db"
BRANCH_TITLE = "Gesamtverzeichnis Lehrveranstaltungen Informatik"
SOURCE_URL = "https://alma.uni-tuebingen.de/alma/pages/cm/exa/coursemanagement/showCourseCatalog.xhtml"

GERMAN_WEEKDAY_INDEX = {
    "Montag": 0, "Dienstag": 1, "Mittwoch": 2, "Donnerstag": 3,
    "Freitag": 4, "Samstag": 5, "Sonntag": 6,
    "Mo.": 0, "Di.": 1, "Mi.": 2, "Do.": 3, "Fr.": 4, "Sa.": 5, "So.": 6,
}
TIME_RANGE_RE = re.compile(r"^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$")
DATE_RANGE_RE = re.compile(r"^\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})\s*$")
SINGLE_DATE_RE = re.compile(r"^\s*(\d{2}\.\d{2}\.\d{4})\s*$")
WEEKDAY_PREFIX_RE = re.compile(r"^\s*(Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b")
# Catalog titles look like "INF2410 Theoretische Informatik 2: ... - Vorlesung".
COURSE_NUMBER_TITLE_RE = re.compile(r"^([A-Z]{2,}[A-Z0-9./-]*)\s+\S")
COURSE_TYPE_TITLE_RE = re.compile(r"\s-\s([^\W\d_][^\d]{1,38})$", re.UNICODE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help=f"Path to courses_multi_semester.json (default: {DEFAULT_INPUT})")
    parser.add_argument("--out-sql", type=Path, default=DEFAULT_OUT_SQL,
                        help=f"Where to write the generated seed SQL (default: {DEFAULT_OUT_SQL})")
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME,
                        help=f"Cloudflare D1 database name to create / target (default: {DEFAULT_DB_NAME})")
    parser.add_argument("--wrangler-toml", type=Path, default=DEFAULT_WRANGLER_TOML,
                        help=f"Path to wrangler.toml to update after success (default: {DEFAULT_WRANGLER_TOML})")
    parser.add_argument("--apply", action="store_true",
                        help="Run the wrangler pipeline (create + migrate + execute + swap binding). Without this, only the SQL file is written.")
    parser.add_argument("--db-id", default=None,
                        help="Existing D1 database id. If provided, --apply will skip create and target this id (and --db-name).")
    parser.add_argument("--local", action="store_true",
                        help="Run wrangler against the local D1 simulator instead of --remote.")
    parser.add_argument("--skip-create", action="store_true", help="With --apply, skip the create step.")
    parser.add_argument("--skip-migrate", action="store_true", help="With --apply, skip migrations apply.")
    parser.add_argument("--skip-seed", action="store_true", help="With --apply, skip the seed SQL execution.")
    parser.add_argument("--skip-swap", action="store_true", help="With --apply, skip the wrangler.toml binding update.")
    return parser.parse_args()


# ----------------------------- SQL helpers ----------------------------------

def sql_literal(value: object) -> str:
    """Format a Python value as a SQLite literal."""
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


# ----------------------------- Data model -----------------------------------

@dataclass
class SeedPlan:
    scrape_run: dict[str, Any] = field(default_factory=dict)
    catalog_nodes: list[dict[str, Any]] = field(default_factory=list)
    catalog_node_paths: list[dict[str, Any]] = field(default_factory=list)
    courses: list[dict[str, Any]] = field(default_factory=list)
    course_fields: list[dict[str, Any]] = field(default_factory=list)
    content_sections: list[dict[str, Any]] = field(default_factory=list)
    course_placements: list[dict[str, Any]] = field(default_factory=list)
    lecturers: list[dict[str, Any]] = field(default_factory=list)
    course_lecturers: list[dict[str, Any]] = field(default_factory=list)
    parallel_groups: list[dict[str, Any]] = field(default_factory=list)
    parallel_group_fields: list[dict[str, Any]] = field(default_factory=list)
    parallel_group_lecturers: list[dict[str, Any]] = field(default_factory=list)
    appointments: list[dict[str, Any]] = field(default_factory=list)


def namespaced_node_id(period_id: str, node_id: str) -> str:
    return f"{period_id}:{node_id}"


def parse_time_range(text: str | None) -> tuple[str | None, str | None]:
    if not text:
        return None, None
    match = TIME_RANGE_RE.match(text)
    if not match:
        return None, None
    return match.group(1), match.group(2)


def parse_date_iso(date_de: str) -> str:
    day, month, year = date_de.split(".")
    return f"{year}-{month}-{day}"


def parse_date_range(text: str | None) -> tuple[str | None, str | None]:
    if not text:
        return None, None
    range_match = DATE_RANGE_RE.match(text)
    if range_match:
        return parse_date_iso(range_match.group(1)), parse_date_iso(range_match.group(2))
    single_match = SINGLE_DATE_RE.match(text)
    if single_match:
        iso = parse_date_iso(single_match.group(1))
        return iso, iso
    return None, None


def extract_weekday(rhythm_text: str | None) -> tuple[str | None, int | None]:
    if not rhythm_text:
        return None, None
    match = WEEKDAY_PREFIX_RE.match(rhythm_text)
    if not match:
        return None, None
    raw = match.group(1)
    index = GERMAN_WEEKDAY_INDEX.get(raw)
    return raw, index


# ----------------------------- Build plan -----------------------------------

def build_seed_plan(data: dict[str, Any]) -> SeedPlan:
    plan = SeedPlan()
    run_id = 1
    now_unix = int(time.time())

    plan.scrape_run = {
        "id": run_id,
        "source_url": SOURCE_URL,
        "branch_title": BRANCH_TITLE,
        "latest_versions_only": 1,
        "partial": 0,
        "fetched_at_unix": now_unix,
        "finished_at_unix": now_unix,
        "raw_source_json": json.dumps(data.get("source") or {}, ensure_ascii=False),
        "imported_at_unix": now_unix,
    }

    seen_node_keys: set[tuple[int, str]] = set()
    for node in data.get("catalog_nodes", []):
        _emit_catalog_node(plan, run_id, node, seen_node_keys)

    lecturer_id_by_name: dict[str, int] = {}
    next_course_id = 1
    next_group_id = 1
    next_appointment_id = 1

    for course in data.get("courses", []):
        _emit_catalog_node(plan, run_id, course, seen_node_keys)
        course_id = next_course_id
        next_course_id += 1
        next_group_id, next_appointment_id = _emit_course(
            plan,
            run_id=run_id,
            course=course,
            course_id=course_id,
            lecturer_id_by_name=lecturer_id_by_name,
            next_group_id=next_group_id,
            next_appointment_id=next_appointment_id,
        )

    for name, lecturer_id in sorted(lecturer_id_by_name.items(), key=lambda pair: pair[1]):
        plan.lecturers.append({
            "id": lecturer_id,
            "display_name": name,
            "title": None,
            "name": name,
            "email": None,
            "department": None,
            "raw_text": name,
        })

    return plan


def _emit_catalog_node(
    plan: SeedPlan,
    run_id: int,
    node: dict[str, Any],
    seen: set[tuple[int, str]],
) -> None:
    period_id = str(node.get("period_id") or "")
    raw_node_id = str(node.get("node_id") or "")
    if not period_id or not raw_node_id:
        return
    namespaced = namespaced_node_id(period_id, raw_node_id)
    key = (run_id, namespaced)
    if key in seen:
        return
    seen.add(key)
    parent_raw = node.get("parent_id")
    parent_namespaced = namespaced_node_id(period_id, str(parent_raw)) if parent_raw else None
    plan.catalog_nodes.append({
        "run_id": run_id,
        "node_id": namespaced,
        "parent_node_id": parent_namespaced,
        "level": int(node.get("level") or 0),
        "title": node.get("title") or "",
        "kind": node.get("kind") or "node",
        "permalink": node.get("permalink"),
        "detail_url": node.get("detail_url"),
        "unit_id": node.get("unit_id"),
        "period_id": period_id,
        "expandable": 1 if node.get("expandable") else 0,
        "expanded": 1 if node.get("expanded") else 0,
        "catalog_path": " > ".join(node.get("path_titles") or []) or None,
        "path_titles_json": json.dumps(node.get("path_titles") or [], ensure_ascii=False),
        "raw_schedule_json": json.dumps(node.get("raw_schedule") or [], ensure_ascii=False),
        "raw_json": json.dumps(node, ensure_ascii=False),
    })


def _emit_course(
    plan: SeedPlan,
    *,
    run_id: int,
    course: dict[str, Any],
    course_id: int,
    lecturer_id_by_name: dict[str, int],
    next_group_id: int,
    next_appointment_id: int,
) -> tuple[int, int]:
    period_id = str(course.get("period_id") or "")
    raw_node_id = str(course.get("node_id") or "")
    namespaced = namespaced_node_id(period_id, raw_node_id)
    details = course.get("details") or {}
    course_lecturer_keys: set[tuple[int, str]] = set()

    fields = details.get("fields") or {}
    catalog_title = course.get("title") or ""

    plan.courses.append({
        "id": course_id,
        "run_id": run_id,
        "node_id": namespaced,
        "unit_id": str(course.get("unit_id") or raw_node_id),
        "period_id": period_id,
        "title": catalog_title,
        "number": fields.get("Nummer") or derive_number_from_title(catalog_title),
        "catalog_title": catalog_title,
        "organisation": fields.get("Organisationseinheit") or fields.get("Heimat-Einrichtung"),
        "course_type": fields.get("Veranstaltungsart") or derive_course_type_from_title(catalog_title),
        "offering_frequency": fields.get("Angebotshäufigkeit"),
        "registration_period": fields.get("Anmeldegruppe"),
        "short_comment": fields.get("Kurzkommentar"),
        "semester_hours": _maybe_float(fields.get("Semesterwochenstunden")),
        "detail_url": course.get("detail_url"),
        "detail_page_url": details.get("url"),
        "raw_fields_json": json.dumps(details.get("fields") or {}, ensure_ascii=False),
        "raw_json": json.dumps(course, ensure_ascii=False),
    })

    plan.course_placements.append({
        "course_id": course_id,
        "run_id": run_id,
        "node_id": namespaced,
    })

    for key, value in (details.get("fields") or {}).items():
        if value is None:
            continue
        plan.course_fields.append({
            "course_id": course_id,
            "key": str(key),
            "value": str(value),
        })

    categories = details.get("categories") or []
    if categories:
        plan.course_fields.append({
            "course_id": course_id,
            "key": "_categories_json",
            "value": json.dumps(categories, ensure_ascii=False),
        })

    for position, section in enumerate(details.get("content", {}).get("sections", []) or [], start=1):
        title = section.get("title")
        text = section.get("text")
        if not title or text is None:
            continue
        plan.content_sections.append({
            "course_id": course_id,
            "position": position,
            "title": title,
            "text": text,
        })

    for group_position, group in enumerate(details.get("parallel_groups") or [], start=1):
        group_id = next_group_id
        next_group_id += 1
        group_fields = group.get("fields") or {}
        plan.parallel_groups.append({
            "id": group_id,
            "course_id": course_id,
            "position": group_position,
            "title": group.get("title"),
            "group_type": group_fields.get("Veranstaltungsart"),
            "language": group_fields.get("Sprache"),
            "responsible_text": group_fields.get("Verantwortliche/-r"),
            "max_participants": _maybe_int(group_fields.get("Maximale Teilnehmerzahl")),
            "min_participants": _maybe_int(group_fields.get("Minimale Teilnehmerzahl")),
            "semester_hours": _maybe_float(group_fields.get("Semesterwochenstunden")),
            "raw_fields_json": json.dumps(group_fields, ensure_ascii=False),
            "raw_json": json.dumps(group, ensure_ascii=False),
        })

        for field_key, field_value in group_fields.items():
            if field_value is None:
                continue
            plan.parallel_group_fields.append({
                "parallel_group_id": group_id,
                "key": str(field_key),
                "value": str(field_value),
            })

        responsible = group_fields.get("Verantwortliche/-r")
        if responsible:
            lecturer_id = _get_or_create_lecturer(lecturer_id_by_name, responsible)
            plan.parallel_group_lecturers.append({
                "parallel_group_id": group_id,
                "lecturer_id": lecturer_id,
                "source": "responsible",
                "source_text": responsible,
            })
            course_link_key = (lecturer_id, "parallel_group_responsible")
            if course_link_key not in course_lecturer_keys:
                course_lecturer_keys.add(course_link_key)
                plan.course_lecturers.append({
                    "course_id": course_id,
                    "lecturer_id": lecturer_id,
                    "source": "parallel_group_responsible",
                    "source_text": responsible,
                })

        for appointment_position, appointment in enumerate(group.get("appointments") or [], start=1):
            appointment_id = next_appointment_id
            next_appointment_id += 1
            rhythm_text = appointment.get("Rhythmus")
            weekday, weekday_index = extract_weekday(rhythm_text)
            start_time, end_time = parse_time_range(appointment.get("Von - Bis"))
            starts_on, ends_on = parse_date_range(appointment.get("Startdatum - Enddatum"))
            plan.appointments.append({
                "id": appointment_id,
                "parallel_group_id": group_id,
                "position": appointment_position,
                "rhythm": rhythm_text,
                "weekday": weekday,
                "weekday_index": weekday_index,
                "time_text": appointment.get("Von - Bis"),
                "start_time": start_time,
                "end_time": end_time,
                "time_note": appointment.get("Zeit-Bemerkung"),
                "date_text": appointment.get("Startdatum - Enddatum"),
                "starts_on": starts_on,
                "ends_on": ends_on,
                "room_text": appointment.get("Raum"),
                "instructors_text": appointment.get("Dozent/-in") or appointment.get("Lehrperson"),
                "expected_participants": _maybe_int(appointment.get("Erwartete Teilnehmerzahl")),
                "note": appointment.get("Bemerkung"),
                "cancellation_text": appointment.get("Ausfall"),
                "raw_json": json.dumps(appointment, ensure_ascii=False),
            })

    return next_group_id, next_appointment_id


def derive_number_from_title(title: str | None) -> str | None:
    """Periods scraped without detail fields still carry the course number as the
    title prefix, e.g. "INF2410 Theoretische Informatik 2 ... - Vorlesung"."""
    if not title:
        return None
    match = COURSE_NUMBER_TITLE_RE.match(title.strip())
    return match.group(1) if match else None


def derive_course_type_from_title(title: str | None) -> str | None:
    """The catalog appends the course type after the last " - " separator."""
    if not title:
        return None
    match = COURSE_TYPE_TITLE_RE.search(title.strip())
    return match.group(1).strip() if match else None


def _maybe_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(str(value).strip().replace(",", "."))
    except ValueError:
        return None


def _maybe_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).strip().replace(",", "."))
    except ValueError:
        return None


def _get_or_create_lecturer(lecturer_id_by_name: dict[str, int], name: str) -> int:
    normalized = name.strip()
    existing = lecturer_id_by_name.get(normalized)
    if existing is not None:
        return existing
    new_id = len(lecturer_id_by_name) + 1
    lecturer_id_by_name[normalized] = new_id
    return new_id


# ----------------------------- SQL writer -----------------------------------

CATALOG_NODE_COLUMNS = [
    "run_id", "node_id", "parent_node_id", "level", "title", "kind", "permalink",
    "detail_url", "unit_id", "period_id", "expandable", "expanded", "catalog_path",
    "path_titles_json", "raw_schedule_json", "raw_json",
]
COURSE_COLUMNS = [
    "id", "run_id", "node_id", "unit_id", "period_id", "title", "number", "catalog_title",
    "organisation", "course_type", "offering_frequency", "registration_period", "short_comment",
    "semester_hours", "detail_url", "detail_page_url", "raw_fields_json", "raw_json",
]
SCRAPE_RUN_COLUMNS = [
    "id", "source_url", "branch_title", "latest_versions_only", "partial",
    "fetched_at_unix", "finished_at_unix", "raw_source_json", "imported_at_unix",
]
COURSE_FIELD_COLUMNS = ["course_id", "key", "value"]
CONTENT_SECTION_COLUMNS = ["course_id", "position", "title", "text"]
COURSE_PLACEMENT_COLUMNS = ["course_id", "run_id", "node_id"]
LECTURER_COLUMNS = ["id", "display_name", "title", "name", "email", "department", "raw_text"]
COURSE_LECTURER_COLUMNS = ["course_id", "lecturer_id", "source", "source_text"]
PARALLEL_GROUP_COLUMNS = [
    "id", "course_id", "position", "title", "group_type", "language", "responsible_text",
    "max_participants", "min_participants", "semester_hours", "raw_fields_json", "raw_json",
]
PARALLEL_GROUP_FIELD_COLUMNS = ["parallel_group_id", "key", "value"]
PARALLEL_GROUP_LECTURER_COLUMNS = ["parallel_group_id", "lecturer_id", "source", "source_text"]
APPOINTMENT_COLUMNS = [
    "id", "parallel_group_id", "position", "rhythm", "weekday", "weekday_index", "time_text",
    "start_time", "end_time", "time_note", "date_text", "starts_on", "ends_on", "room_text",
    "instructors_text", "expected_participants", "note", "cancellation_text", "raw_json",
]
# Children before parents so the seed can be re-applied without FK violations.
SEEDED_TABLES_DELETE_ORDER = [
    "appointments", "parallel_group_lecturers", "parallel_group_fields", "parallel_groups",
    "course_lecturers", "content_sections", "course_fields", "course_placements",
    "courses", "lecturers", "catalog_nodes", "scrape_runs",
]


def write_seed_sql(out_path: Path, plan: SeedPlan) -> None:
    """Emit FK-safe INSERTs for all catalog tables.

    Order: scrape_runs -> catalog_nodes -> lecturers -> courses -> course_placements
    -> course_fields -> content_sections -> course_lecturers -> parallel_groups
    -> parallel_group_fields -> parallel_group_lecturers -> appointments.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        handle.write("-- Generated by backend/scripts/import_alma_json_to_d1.py\n")
        handle.write("-- Inserts ALMA catalog rows into the catalog tables. Run after all migrations.\n\n")
        handle.write("PRAGMA foreign_keys = OFF;\n\n")

        handle.write("-- Clear previously imported catalog rows so the seed is re-runnable.\n")
        for table in SEEDED_TABLES_DELETE_ORDER:
            handle.write(f'DELETE FROM "{table}";\n')
        handle.write("\n")

        handle.write(insert_statement("scrape_runs", SCRAPE_RUN_COLUMNS,
                                      [plan.scrape_run[c] for c in SCRAPE_RUN_COLUMNS]) + "\n\n")
        _write_rows(handle, "catalog_nodes", CATALOG_NODE_COLUMNS, plan.catalog_nodes)
        _write_rows(handle, "lecturers", LECTURER_COLUMNS, plan.lecturers)
        _write_rows(handle, "courses", COURSE_COLUMNS, plan.courses)
        _write_rows(handle, "course_placements", COURSE_PLACEMENT_COLUMNS, plan.course_placements)
        _write_rows(handle, "course_fields", COURSE_FIELD_COLUMNS, plan.course_fields)
        _write_rows(handle, "content_sections", CONTENT_SECTION_COLUMNS, plan.content_sections)
        _write_rows(handle, "course_lecturers", COURSE_LECTURER_COLUMNS, plan.course_lecturers)
        _write_rows(handle, "parallel_groups", PARALLEL_GROUP_COLUMNS, plan.parallel_groups)
        _write_rows(handle, "parallel_group_fields", PARALLEL_GROUP_FIELD_COLUMNS, plan.parallel_group_fields)
        _write_rows(handle, "parallel_group_lecturers", PARALLEL_GROUP_LECTURER_COLUMNS, plan.parallel_group_lecturers)
        _write_rows(handle, "appointments", APPOINTMENT_COLUMNS, plan.appointments)

        handle.write("PRAGMA foreign_keys = ON;\n")


def _write_rows(handle, table: str, columns: list[str], rows: Iterable[dict[str, Any]]) -> None:
    rows = list(rows)
    if not rows:
        handle.write(f"-- (no rows for {table})\n\n")
        return
    handle.write(f"-- {table}: {len(rows)} rows\n")
    for row in rows:
        handle.write(insert_statement(table, columns, [row.get(column) for column in columns]) + "\n")
    handle.write("\n")


# ----------------------------- Wrangler steps -------------------------------

def refresh_windows_path() -> None:
    """Re-read User+Machine PATH from the registry.

    After a fresh `winget install` / `npm install -g`, already-running shells keep
    a stale PATH. This pulls the persisted PATH so child wrangler.cmd calls succeed.
    """
    if os.name != "nt":
        return
    try:
        import winreg
    except ImportError:
        return
    parts: list[str] = []
    for hive, subkey in (
        (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
        (winreg.HKEY_CURRENT_USER, r"Environment"),
    ):
        try:
            with winreg.OpenKey(hive, subkey) as key:
                value, _ = winreg.QueryValueEx(key, "Path")
                parts.append(value)
        except OSError:
            continue
    if parts:
        os.environ["PATH"] = ";".join(parts)


def wrangler_d1_create(db_name: str) -> str:
    print(f"[wrangler] creating D1 database '{db_name}' ...")
    result = subprocess.run(
        ["wrangler", "d1", "create", db_name],
        cwd=ROOT_DIR, capture_output=True, text=True, shell=True,
        encoding="utf-8", errors="replace",
    )
    sys.stdout.write(result.stdout or "")
    sys.stderr.write(result.stderr or "")
    if result.returncode != 0:
        raise SystemExit(f"wrangler d1 create failed (exit {result.returncode})")
    match = re.search(r'database_id\s*=\s*"([0-9a-f-]{36})"', result.stdout or "")
    if not match:
        raise SystemExit("Could not parse new database_id from `wrangler d1 create` output.")
    new_id = match.group(1)
    print(f"[wrangler] created database id = {new_id}")
    return new_id


def wrangler_d1_migrate(db_name: str, *, remote: bool) -> None:
    target = "--remote" if remote else "--local"
    print(f"[wrangler] applying migrations to '{db_name}' {target} ...")
    result = subprocess.run(
        ["wrangler", "d1", "migrations", "apply", db_name, target],
        cwd=ROOT_DIR, text=True, shell=True,
        stdin=subprocess.DEVNULL, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        raise SystemExit(f"wrangler d1 migrations apply failed (exit {result.returncode})")


def wrangler_d1_execute_file(db_name: str, sql_path: Path, *, remote: bool) -> None:
    target = "--remote" if remote else "--local"
    print(f"[wrangler] executing seed SQL on '{db_name}' {target}: {sql_path}")
    result = subprocess.run(
        ["wrangler", "d1", "execute", db_name, target, "--file", str(sql_path)],
        cwd=ROOT_DIR, text=True, shell=True,
        stdin=subprocess.DEVNULL, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        raise SystemExit(f"wrangler d1 execute failed (exit {result.returncode})")


def update_wrangler_toml(toml_path: Path, db_name: str, db_id: str) -> None:
    print(f"[wrangler.toml] updating binding -> name={db_name}, id={db_id}")
    text = toml_path.read_text(encoding="utf-8")
    text = re.sub(r'(database_name\s*=\s*)"[^"]*"', rf'\1"{db_name}"', text, count=1)
    text = re.sub(r'(database_id\s*=\s*)"[^"]*"', rf'\1"{db_id}"', text, count=1)
    toml_path.write_text(text, encoding="utf-8")


# ----------------------------- Main -----------------------------------------

def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"Input JSON not found: {args.input}")

    print(f"[load] {args.input}")
    data = json.loads(args.input.read_text(encoding="utf-8"))
    print(f"[load] courses={len(data.get('courses', []))}, catalog_nodes={len(data.get('catalog_nodes', []))}")

    print("[build] generating seed plan ...")
    plan = build_seed_plan(data)
    print(f"[build] catalog_nodes={len(plan.catalog_nodes)}, courses={len(plan.courses)}, "
          f"parallel_groups={len(plan.parallel_groups)}, appointments={len(plan.appointments)}, "
          f"lecturers={len(plan.lecturers)}, content_sections={len(plan.content_sections)}, "
          f"course_fields={len(plan.course_fields)}")

    print(f"[write] {args.out_sql}")
    write_seed_sql(args.out_sql, plan)

    if not args.apply:
        print("\nSeed SQL written. To push to Cloudflare D1 run again with --apply, or do it manually:")
        target = "--local" if args.local else "--remote"
        print(f"  wrangler d1 create {args.db_name}")
        print(f"  wrangler d1 migrations apply {args.db_name} {target}")
        print(f"  wrangler d1 execute {args.db_name} {target} --file {args.out_sql}")
        return

    refresh_windows_path()
    db_id = args.db_id
    if not args.skip_create and db_id is None:
        db_id = wrangler_d1_create(args.db_name)
    # Swap binding BEFORE migrate/seed so wrangler can resolve the DB by name from wrangler.toml.
    if not args.skip_swap and db_id:
        update_wrangler_toml(args.wrangler_toml, args.db_name, db_id)
    if not args.skip_migrate:
        wrangler_d1_migrate(args.db_name, remote=not args.local)
    if not args.skip_seed:
        wrangler_d1_execute_file(args.db_name, args.out_sql, remote=not args.local)

    print("\nDone. Next steps:")
    print(f"  - Verify counts: wrangler d1 execute {args.db_name} {'--local' if args.local else '--remote'} "
          f"--command \"SELECT COUNT(*) FROM courses;\"")
    print("  - Deploy the worker so it picks up the new binding (cd backend && wrangler deploy).")
    print("  - Delete the old DB once you've verified: wrangler d1 delete studyplaner-db-test")


if __name__ == "__main__":
    main()

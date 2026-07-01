"""Push a scraped ALMA `courses_multi_semester.json` into a Cloudflare D1.

Two ways to run it:

  * Fresh DB (default): --apply creates a new D1, migrates it, seeds it, and
    swaps backend/wrangler.toml to the new id. The old D1 is left intact; delete
    it manually after verifying.

  * In-place re-seed (what production uses): re-seed the *existing*
    `studyplanner-db` without creating or swapping anything. The seed's leading
    DELETEs make it idempotent, so this fully rebuilds the catalog in place:

        py backend/scripts/import_alma_json_to_d1.py \
          --input <courses_multi_semester.json> \
          --apply --skip-create --skip-swap --skip-migrate

    (Per AGENTS.md, the active runtime D1 must NOT be recreated/swapped without
    approval, so re-seeding uses these skip flags. It DELETEs every catalog row
    for all periods and reinserts only what's in the JSON, so a period missing
    from the JSON is dropped from prod.)

Seeding goes through D1's remote import, which has two sharp edges this script
works around (see build_seed_plan / write_seed_chunks / BALLAST_* below):

  * It coalesces every same-table INSERT in one file into a single compound
    statement and rejects it past SQLite's 500-term limit ("too many terms in
    compound SELECT"). Neither multi-row batching nor no-op breaker statements
    stop it — the coalescing spans the whole file. So the seed is split into
    many small per-table chunk files (<=--chunk-rows rows each), executed as
    independent import calls; D1 cannot coalesce across separate imports.
  * A large import (~64MB) resets the D1 Durable Object mid-run
    ({"D1_RESET_DO":true}). The worker never reads the raw_* debug-blob columns,
    so the seed writes minimal placeholders for them, cutting it to ~11MB.

The single-file seed_alma_catalog.sql is still written for inspection; pass
--single-file-seed to execute it directly (only viable for --local).
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
    parser.add_argument("--chunk-rows", type=int, default=300,
                        help="Rows per table per import chunk (default: 300). Kept under SQLite's "
                             "500-term compound limit that D1's remote import otherwise hits.")
    parser.add_argument("--single-file-seed", action="store_true",
                        help="Seed via one d1 execute --file call instead of chunked imports. "
                             "Fails for large catalogs on remote D1; use only for --local.")
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


# Rows per multi-row INSERT. D1's remote import (`wrangler d1 execute --file`)
# coalesces consecutive same-table INSERTs into one compound statement, which
# overflows SQLite's 500-term compound-SELECT limit for large tables
# (catalog_nodes has ~15k rows). Row-batching alone does not help — the import
# re-coalesces the batches — so a no-op breaker statement is emitted between
# batches (see BATCH_BREAKER) to interrupt the coalescing run, and each batch
# stays a modest size to keep the import off D1's per-statement size limit.
INSERT_BATCH_SIZE = 100

# Emitted between INSERT batches so D1's import cannot merge them into one
# over-limit compound statement. A bare SELECT is a no-op the import ignores.
BATCH_BREAKER = "SELECT 1;"

# These NOT NULL (table, column) cells store the unmodified scrape payload for
# debugging. The worker never reads them, and shipping the full blobs bloats the
# seed to ~64MB — large enough that D1's remote import resets the Durable Object
# mid-run. The seed writes each as its schema default placeholder instead,
# cutting the file several-fold while keeping the constraints satisfied.
# NOTE: courses.raw_json is deliberately absent — the worker reads period_label
# from it (see _emit_course), so it keeps a minimal {period_id, period_label}.
BALLAST_CELLS = {
    ("catalog_nodes", "raw_json"): "{}",
    ("catalog_nodes", "raw_schedule_json"): "[]",
    ("courses", "raw_fields_json"): "{}",
    ("parallel_groups", "raw_json"): "{}",
    ("parallel_groups", "raw_fields_json"): "{}",
    ("appointments", "raw_json"): "{}",
}


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
    field_links = _merge_field_links(
        details.get("field_links"),
        (details.get("content") or {}).get("field_links"),
    )
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
        # The worker reads only period_label from courses.raw_json
        # (course_catalog.PERIOD_LABEL_SQL). Keep just that instead of the full
        # course payload so the column stays tiny but period labels still show.
        "raw_json": json.dumps(
            {"period_id": period_id, "period_label": course.get("period_label")},
            ensure_ascii=False,
        ),
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
            "links_json": _links_json(field_links.get(str(key))),
        })

    categories = details.get("categories") or []
    if categories:
        plan.course_fields.append({
            "course_id": course_id,
            "key": "_categories_json",
            "value": json.dumps(categories, ensure_ascii=False),
            "links_json": "[]",
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
            "links_json": _links_json(section.get("links")),
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


def _normalize_links(raw_links: object) -> list[dict[str, str]]:
    if not isinstance(raw_links, list):
        return []

    links: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for raw_link in raw_links:
        if not isinstance(raw_link, dict):
            continue
        url = str(raw_link.get("url") or "").strip()
        if not url:
            continue
        label = str(raw_link.get("label") or url).strip() or url
        key = (label.casefold(), url)
        if key in seen:
            continue
        seen.add(key)
        links.append({"label": label, "url": url})
    return links


def _links_json(raw_links: object) -> str:
    return json.dumps(_normalize_links(raw_links), ensure_ascii=False)


def _merge_field_links(*sources: object) -> dict[str, list[dict[str, str]]]:
    merged: dict[str, list[dict[str, str]]] = {}
    for source in sources:
        if not isinstance(source, dict):
            continue
        for raw_key, raw_links in source.items():
            key = str(raw_key)
            links = _normalize_links(raw_links)
            if not links:
                continue
            merged[key] = _normalize_links([*merged.get(key, []), *links])
    return merged


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
COURSE_FIELD_COLUMNS = ["course_id", "key", "value", "links_json"]
CONTENT_SECTION_COLUMNS = ["course_id", "position", "title", "text", "links_json"]
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
# The curriculum link tables must be cleared too: their course_id values are
# meaningless once courses are re-inserted with fresh ids.
SEEDED_TABLES_DELETE_ORDER = [
    "course_study_area_links", "course_curriculum_matches",
    "appointments", "parallel_group_lecturers", "parallel_group_fields", "parallel_groups",
    "course_lecturers", "content_sections", "course_fields", "course_placements",
    "courses", "lecturers", "catalog_nodes", "scrape_runs",
]

# Rebuild course -> curriculum links from the scraped 'Module / Studiengaenge'
# category codes (the _categories_json course field). Set-based so the seed
# links against whatever study_areas / curriculum_modules the target DB holds.
#
# Kept as separate statements (not one blob) because D1's remote import
# coalesces same-table INSERTs into one compound statement that overflows
# SQLite's 500-term limit; write_seed_chunks emits one import call per statement.
CURRICULUM_LINK_REBUILD_STATEMENTS = [
    # Base study-area links: match each scraped category code to a study area.
    """INSERT OR IGNORE INTO course_study_area_links (course_id, study_area_id, source_code)
SELECT f.course_id, sa.id, je.value
FROM course_fields AS f
JOIN json_each(f.value) AS je
JOIN study_areas AS sa ON sa.code = je.value
WHERE f."key" = '_categories_json';""",
    # (alias study-area links are inserted below, one statement per mapping)
    """INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT f.course_id, cm.id, 'category_code', 0.9
FROM course_fields AS f
JOIN json_each(f.value) AS je
JOIN curriculum_modules AS cm ON cm.module_code = je.value
WHERE f."key" = '_categories_json';""",
    """INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'exact_number', 1.0
FROM courses AS c
JOIN curriculum_modules AS cm ON cm.module_code = c.number;""",
    # Course numbers like 'INF1020-V' belong to module 'INF1020'.
    """INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'number_variant', 0.8
FROM courses AS c
JOIN curriculum_modules AS cm ON c.number LIKE cm.module_code || '-%';""",
]

# Some programs expose study-area membership under codes that differ from the
# seeded study_areas.code: M.Sc. Machine Learning detail pages use MACH-*
# (seeded as ML-*), and B.Sc. Informatik Wahlpflicht modules appear as their
# INFM module numbers. Map those aliases so cross-listed courses still link to
# the right study area. The alias destination is scoped to its program
# (study_areas.code is only unique per program; the B.Sc. codes PRAK/THEO/TECH/
# INFO are deliberately generic), and the original scraped code is kept as
# source_code. Each mapping is its own statement: a single UNION-ALL alias table
# (even ~8 rows) trips D1's import "too many terms in compound SELECT".
STUDY_AREA_CODE_ALIASES = [
    ("MACH-FML", "MSC_ML_2021", "ML-FOUND"),
    ("MACH-DTML", "MSC_ML_2021", "ML-DIVERSE"),
    ("MACH-GCS", "MSC_ML_2021", "ML-CS"),
    ("MACH-EP", "MSC_ML_2021", "ML-EXP"),
    ("INFM3110", "BSC_INFO_2021", "PRAK"),
    ("INFM3410", "BSC_INFO_2021", "THEO"),
    ("INFM3310", "BSC_INFO_2021", "TECH"),
    ("INFM2510", "BSC_INFO_2021", "INFO"),
]

CURRICULUM_LINK_REBUILD_STATEMENTS[1:1] = [
    f"""INSERT OR IGNORE INTO course_study_area_links (course_id, study_area_id, source_code)
SELECT f.course_id, sa.id, je.value
FROM course_fields AS f
JOIN json_each(f.value) AS je
JOIN study_programs AS sp ON sp.code = '{prog}'
JOIN study_areas AS sa ON sa.program_id = sp.id AND sa.code = '{dst}'
WHERE f."key" = '_categories_json' AND je.value = '{src}';"""
    for src, prog, dst in STUDY_AREA_CODE_ALIASES
]

# Single-file form (write_seed_sql / --single-file-seed) keeps them together.
CURRICULUM_LINK_REBUILD_SQL = "\n\n".join(CURRICULUM_LINK_REBUILD_STATEMENTS)


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

        handle.write(CURRICULUM_LINK_REBUILD_SQL + "\n")
        handle.write("PRAGMA foreign_keys = ON;\n")


def _seed_table_plan(plan: SeedPlan) -> list[tuple[str, list[str], list[dict[str, Any]]]]:
    """Ordered (table, columns, rows) triples, parents before children."""
    return [
        ("catalog_nodes", CATALOG_NODE_COLUMNS, plan.catalog_nodes),
        ("lecturers", LECTURER_COLUMNS, plan.lecturers),
        ("courses", COURSE_COLUMNS, plan.courses),
        ("course_placements", COURSE_PLACEMENT_COLUMNS, plan.course_placements),
        ("course_fields", COURSE_FIELD_COLUMNS, plan.course_fields),
        ("content_sections", CONTENT_SECTION_COLUMNS, plan.content_sections),
        ("course_lecturers", COURSE_LECTURER_COLUMNS, plan.course_lecturers),
        ("parallel_groups", PARALLEL_GROUP_COLUMNS, plan.parallel_groups),
        ("parallel_group_fields", PARALLEL_GROUP_FIELD_COLUMNS, plan.parallel_group_fields),
        ("parallel_group_lecturers", PARALLEL_GROUP_LECTURER_COLUMNS, plan.parallel_group_lecturers),
        ("appointments", APPOINTMENT_COLUMNS, plan.appointments),
    ]


def write_seed_chunks(out_dir: Path, plan: SeedPlan, rows_per_chunk: int) -> list[Path]:
    """Write the seed as many small SQL files, one import call each.

    D1's remote import coalesces every same-table INSERT in a *single* file
    into one compound statement, overflowing SQLite's 500-term limit. Splitting
    the seed across independent import calls caps each file at
    ``rows_per_chunk`` rows per table, so the coalesced statement stays small.
    Every chunk disables foreign keys itself because each import runs on its own
    connection and the rows are not in parent-before-child order.

    Returns the ordered list of chunk paths to execute.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("chunk_*.sql"):
        stale.unlink()

    chunks: list[Path] = []

    def new_chunk(name: str) -> Path:
        path = out_dir / f"chunk_{len(chunks):04d}_{name}.sql"
        chunks.append(path)
        return path

    # 1. Clear existing rows + insert the single scrape_runs row.
    with new_chunk("reset").open("w", encoding="utf-8") as handle:
        handle.write("PRAGMA foreign_keys = OFF;\n")
        for table in SEEDED_TABLES_DELETE_ORDER:
            handle.write(f'DELETE FROM "{table}";\n')
        handle.write(insert_statement("scrape_runs", SCRAPE_RUN_COLUMNS,
                                      [plan.scrape_run[c] for c in SCRAPE_RUN_COLUMNS]) + "\n")

    # 2. One or more chunks per table, capped at rows_per_chunk rows each.
    for table, columns, rows in _seed_table_plan(plan):
        for start in range(0, len(rows), rows_per_chunk):
            slice_rows = rows[start : start + rows_per_chunk]
            with new_chunk(table).open("w", encoding="utf-8") as handle:
                handle.write("PRAGMA foreign_keys = OFF;\n")
                _write_rows(handle, table, columns, slice_rows)

    # 3. Rebuild the curriculum links once every course/field row exists. One
    #    chunk per statement so D1's import cannot coalesce the same-table
    #    INSERTs into an over-limit compound statement.
    for statement in CURRICULUM_LINK_REBUILD_STATEMENTS:
        with new_chunk("links").open("w", encoding="utf-8") as handle:
            handle.write("PRAGMA foreign_keys = OFF;\n")
            handle.write(statement + "\n")

    return chunks


def _write_rows(handle, table: str, columns: list[str], rows: Iterable[dict[str, Any]]) -> None:
    rows = list(rows)
    if not rows:
        handle.write(f"-- (no rows for {table})\n\n")
        return
    handle.write(f"-- {table}: {len(rows)} rows\n")
    column_list = ", ".join(f'"{column}"' for column in columns)

    def cell(column: str, row: dict[str, Any]) -> str:
        placeholder = BALLAST_CELLS.get((table, column))
        if placeholder is not None:
            return sql_literal(placeholder)
        return sql_literal(row.get(column))

    for start in range(0, len(rows), INSERT_BATCH_SIZE):
        batch = rows[start : start + INSERT_BATCH_SIZE]
        tuples = ",\n".join(
            "(" + ", ".join(cell(column, row) for column in columns) + ")"
            for row in batch
        )
        handle.write(f'INSERT INTO "{table}" ({column_list}) VALUES\n{tuples};\n')
        handle.write(BATCH_BREAKER + "\n")
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


def wrangler_d1_execute_file(db_name: str, sql_path: Path, *, remote: bool, attempts: int = 3) -> None:
    target = "--remote" if remote else "--local"
    print(f"[wrangler] executing seed SQL on '{db_name}' {target}: {sql_path}")
    # A failed D1 import rolls back to its prior state, so retrying is safe. The
    # chunked seed makes many import calls; a single transient network blip
    # ("fetch failed") should not abort the whole re-seed.
    for attempt in range(1, attempts + 1):
        result = subprocess.run(
            ["wrangler", "d1", "execute", db_name, target, "--file", str(sql_path)],
            cwd=ROOT_DIR, text=True, shell=True,
            stdin=subprocess.DEVNULL, encoding="utf-8", errors="replace",
        )
        if result.returncode == 0:
            return
        if attempt < attempts:
            print(f"[wrangler] execute failed (exit {result.returncode}), "
                  f"retry {attempt + 1}/{attempts} in 5s ...")
            time.sleep(5)
    raise SystemExit(f"wrangler d1 execute failed after {attempts} attempts")


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
        if args.single_file_seed:
            wrangler_d1_execute_file(args.db_name, args.out_sql, remote=not args.local)
        else:
            chunk_dir = args.out_sql.parent / "seed_chunks"
            chunks = write_seed_chunks(chunk_dir, plan, args.chunk_rows)
            print(f"[seed] executing {len(chunks)} chunk files from {chunk_dir} ...")
            for index, chunk in enumerate(chunks, start=1):
                print(f"[seed] chunk {index}/{len(chunks)}: {chunk.name}")
                wrangler_d1_execute_file(args.db_name, chunk, remote=not args.local)

    print("\nDone. Next steps:")
    print(f"  - Verify counts: wrangler d1 execute {args.db_name} {'--local' if args.local else '--remote'} "
          f"--command \"SELECT COUNT(*) FROM courses;\"")
    print("  - Deploy the worker so it picks up the new binding (cd backend && wrangler deploy).")
    print("  - Delete the old DB once you've verified: wrangler d1 delete studyplaner-db-test")


if __name__ == "__main__":
    main()

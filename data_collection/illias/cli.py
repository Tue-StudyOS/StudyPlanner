from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from .config import load_env
from .db import connect, import_scrape, load_illias_courses, save_matches
from .matcher import load_alma_candidates, match_courses
from .scraper import DEFAULT_INFORMATICS_URL, IliasScraper


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV = Path(__file__).resolve().parent / ".env"
DEFAULT_ILLIAS_DB = REPO_ROOT / "data_collection" / "output" / "illias.sqlite"
DEFAULT_ALMA_DB = REPO_ROOT / "backend" / "data" / "alma.sqlite"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape read-only ILIAS course metadata and match it to ALMA.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scrape = subparsers.add_parser("scrape", help="Fetch Informatik courses from ILIAS and store them locally.")
    scrape.add_argument("--env", type=Path, default=DEFAULT_ENV)
    scrape.add_argument("--url", default=DEFAULT_INFORMATICS_URL)
    scrape.add_argument("--db", type=Path, default=DEFAULT_ILLIAS_DB)
    scrape.add_argument("--out-json", type=Path, help="Optional raw JSON output path.")
    scrape.add_argument("--timeout", type=float, default=30.0)
    scrape.add_argument("--max-courses", type=int, help="Limit detail fetches for smoke tests.")
    scrape.add_argument("--max-depth", type=int, default=1, help="Repository category crawl depth.")

    match = subparsers.add_parser("match", help="Match scraped ILIAS rows against ALMA courses.")
    match.add_argument("--illias-db", type=Path, default=DEFAULT_ILLIAS_DB)
    match.add_argument("--alma-db", type=Path, default=DEFAULT_ALMA_DB)
    match.add_argument("--period-label", help="Limit ALMA candidates, e.g. 'Sommer 2026'.")
    match.add_argument("--out-json", type=Path, help="Optional match report JSON path.")

    export = subparsers.add_parser("export-sql", help="Export matched ILIAS metadata as D1 seed SQL.")
    export.add_argument("--illias-db", type=Path, default=DEFAULT_ILLIAS_DB)
    export.add_argument("--out", type=Path, default=REPO_ROOT / "backend" / "data" / "seed_illias.sql")

    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "scrape":
        _run_scrape(args)
    elif args.command == "match":
        _run_match(args)
    elif args.command == "export-sql":
        _run_export_sql(args)


def _run_scrape(args: argparse.Namespace) -> None:
    env = load_env(args.env)
    username = env.get("user") or env.get("username")
    password = env.get("password")
    if not username or not password:
        raise SystemExit(f"Missing user/password in {args.env}")
    scraper = IliasScraper(username=username, password=password, timeout=args.timeout)
    payload = scraper.scrape_repository(
        args.url,
        max_courses=args.max_courses,
        max_depth=args.max_depth,
    )
    if args.out_json:
        args.out_json.parent.mkdir(parents=True, exist_ok=True)
        args.out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with connect(args.db) as connection:
        run_id = import_scrape(connection, payload)
    print(f"Wrote {len(payload.get('courses') or [])} ILIAS courses to {args.db} (run {run_id}).")


def _run_match(args: argparse.Namespace) -> None:
    with connect(args.illias_db) as connection:
        illias_courses = load_illias_courses(connection)
        alma_candidates = load_alma_candidates(args.alma_db, period_label=args.period_label)
        if args.period_label and not alma_candidates:
            fallback_candidates = load_alma_candidates(args.alma_db)
            available_periods = {candidate.period_label for candidate in fallback_candidates}
            if len(available_periods) == 1:
                alma_candidates = fallback_candidates
                only_period = next(iter(available_periods))
                print(
                    f"No ALMA rows matched period label {args.period_label!r}; "
                    f"using the only local period {only_period!r}."
                )
        matches = match_courses(illias_courses, alma_candidates)
        save_matches(connection, matches)
    if args.out_json:
        args.out_json.parent.mkdir(parents=True, exist_ok=True)
        args.out_json.write_text(
            json.dumps([asdict(match) for match in matches], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    matched = sum(1 for match in matches if match.alma_course_id is not None)
    unresolved = len(matches) - matched
    print(
        f"Matched {matched}/{len(matches)} ILIAS courses against "
        f"{len(alma_candidates)} ALMA candidates; unresolved={unresolved}."
    )


def _sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def _insert_statement(table: str, columns: list[str], values: list[object]) -> str:
    column_list = ", ".join(f'"{column}"' for column in columns)
    value_list = ", ".join(_sql_literal(value) for value in values)
    return f'INSERT INTO "{table}" ({column_list}) VALUES ({value_list});'


def _run_export_sql(args: argparse.Namespace) -> None:
    with connect(args.illias_db) as connection:
        latest_run = connection.execute("SELECT MAX(id) AS run_id FROM illias_scrape_runs").fetchone()
        latest_run_id = latest_run["run_id"] if latest_run else None
        if latest_run_id is None:
            raise SystemExit(f"No ILIAS scrape runs found in {args.illias_db}")
        runs = connection.execute(
            """
            SELECT id, source_url, fetched_at_unix, raw_source_json
            FROM illias_scrape_runs
            WHERE id = ?
            ORDER BY id
            """,
            (latest_run_id,),
        ).fetchall()
        courses = connection.execute(
            """
            SELECT ref_id, run_id, title, url, object_type, description,
                   availability, registration, deadline, max_participants,
                   tags_json, instructors_json, raw_fields_json, raw_text,
                   imported_at_unix
            FROM illias_courses
            WHERE run_id = ?
            ORDER BY ref_id
            """,
            (latest_run_id,),
        ).fetchall()
        fields = connection.execute(
            """
            SELECT f.course_ref_id, f.key, f.value
            FROM illias_course_fields AS f
            JOIN illias_courses AS c ON c.ref_id = f.course_ref_id
            WHERE c.run_id = ?
            ORDER BY f.course_ref_id, f.key
            """,
            (latest_run_id,),
        ).fetchall()
        matches = connection.execute(
            """
            SELECT m.illias_course_ref_id, m.alma_course_id, m.confidence, m.match_type,
                   m.notes, m.candidate_count, m.matched_at_unix
            FROM illias_alma_matches AS m
            JOIN illias_courses AS c ON c.ref_id = m.illias_course_ref_id
            WHERE c.run_id = ?
            ORDER BY m.illias_course_ref_id
            """,
            (latest_run_id,),
        ).fetchall()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as handle:
        handle.write("-- Generated by data_collection/illias/cli.py export-sql\n")
        handle.write("PRAGMA foreign_keys = OFF;\n\n")
        for table in ("illias_alma_matches", "illias_course_fields", "illias_courses", "illias_scrape_runs"):
            handle.write(f'DELETE FROM "{table}";\n')
        handle.write("\n")
        for row in runs:
            handle.write(_insert_statement("illias_scrape_runs", list(row.keys()), list(row)) + "\n")
        for row in courses:
            handle.write(_insert_statement("illias_courses", list(row.keys()), list(row)) + "\n")
        for row in fields:
            handle.write(_insert_statement("illias_course_fields", list(row.keys()), list(row)) + "\n")
        for row in matches:
            handle.write(_insert_statement("illias_alma_matches", list(row.keys()), list(row)) + "\n")
        handle.write("\nPRAGMA foreign_keys = ON;\n")
    print(
        f"Wrote ILIAS seed SQL to {args.out} "
        f"(runs={len(runs)}, courses={len(courses)}, matches={len(matches)})."
    )


if __name__ == "__main__":
    main()

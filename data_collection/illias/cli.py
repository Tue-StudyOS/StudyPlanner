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

    match = subparsers.add_parser("match", help="Match scraped ILIAS rows against ALMA courses.")
    match.add_argument("--illias-db", type=Path, default=DEFAULT_ILLIAS_DB)
    match.add_argument("--alma-db", type=Path, default=DEFAULT_ALMA_DB)
    match.add_argument("--period-label", help="Limit ALMA candidates, e.g. 'Sommer 2026'.")
    match.add_argument("--out-json", type=Path, help="Optional match report JSON path.")

    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "scrape":
        _run_scrape(args)
    elif args.command == "match":
        _run_match(args)


def _run_scrape(args: argparse.Namespace) -> None:
    env = load_env(args.env)
    username = env.get("user") or env.get("username")
    password = env.get("password")
    if not username or not password:
        raise SystemExit(f"Missing user/password in {args.env}")
    scraper = IliasScraper(username=username, password=password, timeout=args.timeout)
    payload = scraper.scrape_repository(args.url)
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


if __name__ == "__main__":
    main()


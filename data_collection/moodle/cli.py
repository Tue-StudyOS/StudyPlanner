from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from .matching import build_match_payload, load_alma_candidates, write_json as write_match_json
from .scraper import (
    DEFAULT_INFORMATICS_CATEGORY_URL,
    MoodleScrapeOptions,
    MoodleScraper,
    write_json as write_scrape_json,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape public Moodle category data and optionally match it to ALMA courses."
    )
    parser.add_argument(
        "--category-url",
        default=DEFAULT_INFORMATICS_CATEGORY_URL,
        help="Public Moodle category URL to scrape.",
    )
    parser.add_argument(
        "--out",
        default="",
        help="Scrape JSON output path. Defaults to output/<timestamp>/moodle_courses.json.",
    )
    parser.add_argument(
        "--fetch-course-pages",
        action="store_true",
        help="Also fetch every public course/enrolment page for enrolment labels.",
    )
    parser.add_argument("--max-pages", type=int, help="Stop after N category pages.")
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP timeout in seconds.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    parser.add_argument(
        "--match-sqlite",
        type=Path,
        help="Path to backend/data/alma.sqlite. When set, also write match output.",
    )
    parser.add_argument(
        "--period-id",
        help="Optional ALMA period_id used to scope matching candidates.",
    )
    parser.add_argument(
        "--matches-out",
        type=Path,
        help="Match JSON output path. Defaults next to --out as moodle_matches.json.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    out_path = resolve_out_path(args.out)
    scraper = MoodleScraper(timeout=args.timeout)
    payload = scraper.scrape(
        MoodleScrapeOptions(
            category_url=args.category_url,
            fetch_course_pages=args.fetch_course_pages,
            max_pages=args.max_pages,
            timeout=args.timeout,
        )
    )
    write_scrape_json(out_path, payload, pretty=args.pretty)
    print(f"Wrote {len(payload['courses'])} Moodle courses to {out_path}")

    if not args.match_sqlite:
        return
    candidates = load_alma_candidates(args.match_sqlite, period_id=args.period_id)
    match_payload = build_match_payload(payload, candidates)
    matches_out = args.matches_out or out_path.parent / "moodle_matches.json"
    write_match_json(matches_out, match_payload, pretty=args.pretty)
    accepted = sum(1 for match in match_payload["matches"] if match["status"] == "accepted")
    review = sum(1 for match in match_payload["matches"] if match["status"] == "needs_review")
    unmatched = sum(1 for match in match_payload["matches"] if match["status"] == "unmatched")
    print(
        f"Wrote matches to {matches_out} "
        f"(accepted={accepted}, needs_review={review}, unmatched={unmatched})"
    )


def resolve_out_path(raw_path: str) -> Path:
    if raw_path:
        return Path(raw_path)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return Path("output") / timestamp / "moodle_courses.json"


if __name__ == "__main__":
    main()

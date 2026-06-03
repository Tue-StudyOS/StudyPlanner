from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .scraper import (
    AlmaScraper,
    PeriodOption,
    ScrapeOptions,
    parse_semester_tuple,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape public course catalog data from alma.uni-tuebingen.de."
    )
    parser.add_argument(
        "--start-url",
        default=AlmaScraper.INFORMATICS_COURSES_URL,
        help=(
            "Catalog URL or stable ALMA permalink to start from. "
            "Defaults to the Informatik course catalog (Gesamtverzeichnis "
            "Lehrveranstaltungen Informatik)."
        ),
    )
    parser.add_argument(
        "--branch-title",
        help="Only expand branches whose title contains this text.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        help="Maximum tree level to expand. Root is level 0.",
    )
    parser.add_argument(
        "--max-courses",
        type=int,
        help="Stop after this many course/detail entries have been collected.",
    )
    parser.add_argument(
        "--details",
        action="store_true",
        help="Fetch each course detail page and extract schedules/fields.",
    )
    parser.add_argument(
        "--full-catalog",
        action="store_true",
        help="Scrape the full catalog, fetch course details, and keep only newest Version branches.",
    )
    parser.add_argument(
        "--include-old-versions",
        action="store_true",
        help="Do not skip older '(Version YYYY)' catalog branches.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout in seconds.",
    )
    parser.add_argument(
        "--out",
        default="",
        help="JSON output path. If empty, uses output/YYYY-MM-DD_HH-MM-SS/ folder structure.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output.",
    )
    parser.add_argument(
        "--progress-file",
        default="",
        help="Small JSON file updated during scraping. If empty, uses output folder.",
    )
    parser.add_argument(
        "--checkpoint-every",
        type=int,
        default=10,
        help="Write partial output every N course details.",
    )
    parser.add_argument(
        "--max-runtime-seconds",
        type=int,
        help="Stop gracefully after this many seconds and write partial output.",
    )
    parser.add_argument(
        "--max-expansions",
        type=int,
        help="Stop gracefully after expanding this many catalog nodes.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print progress messages.",
    )
    parser.add_argument(
        "--list-periods",
        action="store_true",
        help=(
            "Print the period IDs ALMA currently offers (period_id <TAB> label), "
            "then exit. Useful for picking a --from-semester value."
        ),
    )
    parser.add_argument(
        "--dump-period-candidates",
        metavar="DIR",
        help=(
            "Save the catalog start page and a structured summary of every "
            "candidate period-selector element to DIR, then exit. Diagnostic "
            "for when --list-periods returns nothing."
        ),
    )
    parser.add_argument(
        "--from-semester",
        metavar="LABEL",
        help=(
            "Scrape every semester from this label up to the most recent (e.g. "
            "'Sommer 2022'). Each period rediscovers the Informatik branch by "
            "title chain, since the path IDs differ across semesters."
        ),
    )
    parser.add_argument(
        "--probe-branch-permalink",
        metavar="PERIOD_ID",
        help=(
            "Discover the Informatik branch permalink for this period via "
            "AlmaScraper.find_branch_permalink and print it, then exit. "
            "Sanity check for multi-period mode."
        ),
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    def progress(message: str) -> None:
        if not args.quiet:
            print(message, file=sys.stderr, flush=True)

    scraper = AlmaScraper(timeout=args.timeout, progress=progress)

    if args.list_periods:
        for period in scraper.discover_periods():
            print(f"{period.period_id}\t{period.label}")
        return

    if args.dump_period_candidates:
        counts = scraper.dump_period_candidates(args.dump_period_candidates)
        for source, count in counts.items():
            print(f"{source}: {count}")
        return

    if args.probe_branch_permalink:
        scraper.fetch_catalog_page(AlmaScraper.INFORMATICS_COURSES_URL)
        permalink = scraper.find_branch_permalink(
            args.probe_branch_permalink, AlmaScraper.INFORMATICS_BRANCH_CHAIN
        )
        print(f"period {args.probe_branch_permalink}: {permalink}")
        return

    out_path, progress_path = _resolve_output_paths(args)

    if args.from_semester:
        result = _run_multi_period_scrape(scraper, args, out_path, progress_path)
    else:
        result = _run_single_period_scrape(scraper, args, out_path, progress_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2 if args.pretty else None,
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    print(
        f"Wrote {len(result['courses'])} courses and "
        f"{len(result['catalog_nodes'])} catalog nodes to {out_path}"
    )


def _resolve_output_paths(args: argparse.Namespace) -> tuple[Path, str]:
    """Return the (output_file, progress_file) pair to use for this run."""
    if not args.out:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_dir = Path("output") / timestamp
        output_dir.mkdir(parents=True, exist_ok=True)
        if args.full_catalog:
            filename = "full_catalog.json"
        elif args.from_semester:
            filename = "courses_multi_semester.json"
        elif args.branch_title:
            safe_name = "".join(
                character if character.isalnum() or character in " -_" else "_"
                for character in args.branch_title
            )
            filename = f"{safe_name}.json"
        else:
            filename = "courses.json"
        out_path = output_dir / filename
        progress_path = str(output_dir / "progress.json")
    else:
        out_path = Path(args.out)
        progress_path = args.progress_file or str(out_path.parent / "progress.json")
    return out_path, progress_path


def _run_single_period_scrape(
    scraper: AlmaScraper,
    args: argparse.Namespace,
    out_path: Path,
    progress_path: str,
) -> dict:
    options = ScrapeOptions(
        start_url=args.start_url,
        branch_title=None if args.full_catalog else args.branch_title,
        max_depth=None if args.full_catalog else args.max_depth,
        max_courses=None if args.full_catalog else args.max_courses,
        fetch_details=args.details or args.full_catalog,
        latest_versions_only=not args.include_old_versions,
        progress_file=progress_path,
        checkpoint_path=str(out_path) if (args.details or args.full_catalog) else None,
        checkpoint_every=args.checkpoint_every,
        max_runtime_seconds=args.max_runtime_seconds,
        max_expansions=args.max_expansions,
    )
    return scraper.scrape(options)


def _run_multi_period_scrape(
    scraper: AlmaScraper,
    args: argparse.Namespace,
    out_path: Path,
    progress_path: str,
) -> dict:
    """Run the scraper once per discovered period and merge results.

    For each period:
      1. Switch to that period via the Semesterauswahl dropdown
         (:meth:`AlmaScraper.find_branch_permalink`), discovering the
         period-specific Informatik permalink because the deep-path title
         IDs are not stable across semesters.
      2. Scrape using that permalink as ``start_url`` so the existing
         start-path scoping just works.
      3. Tag every course with ``period_id`` and ``period_label``.

    A checkpoint is written after every period so an interrupted run still
    leaves a usable output file.
    """
    cutoff = parse_semester_tuple(args.from_semester)
    if cutoff is None:
        raise SystemExit(
            f"Could not parse --from-semester={args.from_semester!r} "
            "(expected e.g. 'Sommer 2022' or 'Wintersemester 2022/23')."
        )

    periods = _select_periods(scraper.discover_periods(), cutoff)
    if not periods:
        raise SystemExit(f"No periods found at or after {args.from_semester!r}.")

    print(
        f"Scraping {len(periods)} period(s) from {periods[0].label} "
        f"to {periods[-1].label}",
        file=sys.stderr,
        flush=True,
    )

    all_courses: list[dict] = []
    all_catalog_nodes: list[dict] = []
    per_period_summary: list[dict] = []

    for index, period in enumerate(periods, start=1):
        print(
            f"=== [{index}/{len(periods)}] period {period.period_id} "
            f"({period.label}) ===",
            file=sys.stderr,
            flush=True,
        )
        permalink = scraper.find_branch_permalink(
            period.period_id, AlmaScraper.INFORMATICS_BRANCH_CHAIN
        )
        if not permalink:
            print(
                f"  ! could not find Informatik branch for {period.label}; skipping",
                file=sys.stderr,
                flush=True,
            )
            per_period_summary.append(
                {
                    "period_id": period.period_id,
                    "period_label": period.label,
                    "courses": 0,
                    "catalog_nodes": 0,
                    "skipped": True,
                }
            )
            _write_multi_period_checkpoint(
                out_path, args, periods, per_period_summary,
                all_catalog_nodes, all_courses,
            )
            continue

        period_options = ScrapeOptions(
            start_url=permalink,
            branch_title=None,
            max_depth=args.max_depth,
            max_courses=args.max_courses,
            fetch_details=args.details or args.full_catalog,
            latest_versions_only=not args.include_old_versions,
            progress_file=progress_path,
            checkpoint_path=None,
            checkpoint_every=args.checkpoint_every,
            max_runtime_seconds=args.max_runtime_seconds,
            max_expansions=args.max_expansions,
            restrict_to_start_path=True,
        )
        result = scraper.scrape(period_options)
        for course in result["courses"]:
            course["period_id"] = period.period_id
            course["period_label"] = period.label
        for node in result["catalog_nodes"]:
            node["period_label"] = period.label
        all_courses.extend(result["courses"])
        all_catalog_nodes.extend(result["catalog_nodes"])
        per_period_summary.append(
            {
                "period_id": period.period_id,
                "period_label": period.label,
                "courses": len(result["courses"]),
                "catalog_nodes": len(result["catalog_nodes"]),
                "partial": bool(result["source"].get("partial")),
            }
        )
        _write_multi_period_checkpoint(
            out_path,
            args,
            periods,
            per_period_summary,
            all_catalog_nodes,
            all_courses,
        )

    return _multi_period_result(
        args, periods, per_period_summary, all_catalog_nodes, all_courses
    )


def _select_periods(
    periods: list[PeriodOption], cutoff: tuple[int, int]
) -> list[PeriodOption]:
    return [period for period in periods if period.semester and period.semester >= cutoff]


def _multi_period_result(
    args: argparse.Namespace,
    periods: list[PeriodOption],
    per_period_summary: list[dict],
    catalog_nodes: list[dict],
    courses: list[dict],
) -> dict:
    return {
        "source": {
            "mode": "multi-period",
            "from_semester": args.from_semester,
            "periods": [
                {"period_id": period.period_id, "period_label": period.label}
                for period in periods
            ],
            "per_period_summary": per_period_summary,
        },
        "catalog_nodes": catalog_nodes,
        "courses": courses,
    }


def _write_multi_period_checkpoint(
    out_path: Path,
    args: argparse.Namespace,
    periods: list[PeriodOption],
    per_period_summary: list[dict],
    catalog_nodes: list[dict],
    courses: list[dict],
) -> None:
    payload = _multi_period_result(
        args, periods, per_period_summary, catalog_nodes, courses
    )
    payload["source"]["partial"] = len(per_period_summary) < len(periods)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

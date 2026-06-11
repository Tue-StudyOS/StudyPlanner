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
        "--continue",
        dest="continue_from",
        metavar="PATH",
        help=(
            "Resume an interrupted multi-period scrape from the JSON file "
            "PATH (the courses_multi_semester.json from the previous run). "
            "Fully completed periods are kept and skipped; partial/skipped "
            "periods are redone. Output is written back to PATH. Inherits "
            "--from-semester from the file unless explicitly overridden."
        ),
    )
    parser.add_argument(
        "--redo-periods",
        metavar="LABELS",
        help=(
            "With --continue: comma-separated period labels or ids to scrape "
            "again even though the previous run completed them. Their old "
            "courses are dropped and replaced by the fresh scrape."
        ),
    )
    parser.add_argument(
        "--probe-course-details",
        metavar="DETAIL_URL",
        help=(
            "Fetch one course detail page and print what the parser "
            "extracted (fields, categories, content sections, parallel "
            "groups), then exit. Diagnostic for archived periods whose "
            "Grunddaten fields come back empty."
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

    if args.probe_course_details:
        _probe_course_details(scraper, args.probe_course_details)
        return

    if args.probe_branch_permalink:
        scraper.fetch_catalog_page(AlmaScraper.INFORMATICS_COURSES_URL)
        permalink = scraper.find_branch_permalink(
            args.probe_branch_permalink, AlmaScraper.INFORMATICS_BRANCH_CHAIN
        )
        print(f"period {args.probe_branch_permalink}: {permalink}")
        return

    resume_state = _load_resume_state(args)
    out_path, progress_path = _resolve_output_paths(args, resume_state)

    if args.from_semester or resume_state is not None:
        result = _run_multi_period_scrape(
            scraper, args, out_path, progress_path, resume_state
        )
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


def _probe_course_details(scraper: AlmaScraper, detail_url: str) -> None:
    """Print a one-page summary of what the detail parser extracts.

    Used to diagnose archived-period scrapes where Grunddaten fields came
    back empty even though the detail pages were fetched.
    """
    details = scraper.fetch_course_details(detail_url)
    fields = details.get("fields") or {}
    categories = details.get("categories") or []
    sections = (details.get("content") or {}).get("sections") or []
    groups = details.get("parallel_groups") or []
    print(f"url: {details.get('url')}")
    print(f"page_title: {details.get('page_title')!r}")
    print(f"fields ({len(fields)}):")
    for key, value in fields.items():
        print(f"  {key}: {value[:80]!r}")
    print(f"categories ({len(categories)}): {categories}")
    print(f"content sections ({len(sections)}): {[section.get('title') for section in sections]}")
    print(f"parallel groups ({len(groups)}): {[group.get('title') for group in groups]}")


def _resolve_output_paths(
    args: argparse.Namespace, resume_state: dict | None = None
) -> tuple[Path, str]:
    """Return the (output_file, progress_file) pair to use for this run.

    When resuming, the output is written back to the original file so the
    user ends up with a single merged JSON.
    """
    if resume_state is not None:
        out_path = Path(args.continue_from)
        progress_path = args.progress_file or str(out_path.parent / "progress.json")
        return out_path, progress_path
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


def _load_resume_state(args: argparse.Namespace) -> dict | None:
    """Read the previous multi-period output and inherit ``from_semester``.

    Returns a dict with keys ``courses``, ``catalog_nodes``,
    ``per_period_summary``, ``completed_period_ids`` (a set of period IDs
    that finished successfully and should be skipped on resume) and
    ``completed_period_labels`` (the same set keyed by label, for files
    written before catalog nodes were tagged with ``period_id``).
    Returns ``None`` when no ``--continue`` was passed.
    """
    if not args.continue_from:
        return None
    path = Path(args.continue_from)
    if not path.is_file():
        raise SystemExit(f"--continue file not found: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    source = payload.get("source") or {}
    if source.get("mode") != "multi-period":
        raise SystemExit(
            f"--continue file is not from a multi-period run: {path}"
        )
    summary = source.get("per_period_summary") or []
    redo_tokens = {
        token.strip()
        for token in (args.redo_periods or "").split(",")
        if token.strip()
    }
    completed_entries = [
        entry
        for entry in summary
        if not entry.get("partial")
        and not entry.get("skipped")
        and entry.get("period_id") not in redo_tokens
        and entry.get("period_label") not in redo_tokens
    ]
    completed_ids: set[str] = {entry["period_id"] for entry in completed_entries}
    completed_labels: set[str] = {
        entry["period_label"] for entry in completed_entries if entry.get("period_label")
    }
    if not args.from_semester:
        args.from_semester = source.get("from_semester")
    return {
        "courses": payload.get("courses", []),
        "catalog_nodes": payload.get("catalog_nodes", []),
        "per_period_summary": completed_entries,
        "completed_period_ids": completed_ids,
        "completed_period_labels": completed_labels,
    }


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
    resume_state: dict | None = None,
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

    With ``resume_state`` (from ``--continue``), already-completed periods
    are skipped and their existing courses/nodes feed the accumulator
    directly.
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

    if resume_state is not None:
        completed_ids = resume_state["completed_period_ids"]
        completed_labels = resume_state["completed_period_labels"]
        # period_label fallback handles files written before catalog nodes
        # were tagged with period_id (those nodes only carry period_label,
        # and course rows added before period_id was tagged carry neither).
        all_courses = [
            course for course in resume_state["courses"]
            if course.get("period_id") in completed_ids
               or course.get("period_label") in completed_labels
        ]
        all_catalog_nodes = [
            node for node in resume_state["catalog_nodes"]
            if node.get("period_id") in completed_ids
               or node.get("period_label") in completed_labels
        ]
        per_period_summary = list(resume_state["per_period_summary"])
        remaining = [p for p in periods if p.period_id not in completed_ids]
        print(
            f"Resuming: {len(completed_ids)} period(s) already complete, "
            f"{len(remaining)} to go",
            file=sys.stderr,
            flush=True,
        )
    else:
        all_courses = []
        all_catalog_nodes = []
        per_period_summary = []
        remaining = list(periods)
        print(
            f"Scraping {len(periods)} period(s) from {periods[0].label} "
            f"to {periods[-1].label}",
            file=sys.stderr,
            flush=True,
        )

    for index, period in enumerate(remaining, start=1):
        print(
            f"=== [{index}/{len(remaining)}] period {period.period_id} "
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
            node["period_id"] = period.period_id
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

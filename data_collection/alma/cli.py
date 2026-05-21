from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .scraper import AlmaScraper, ScrapeOptions


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
    return parser


def main() -> None:
    args = build_parser().parse_args()
    def progress(message: str) -> None:
        if not args.quiet:
            print(message, file=sys.stderr, flush=True)

    scraper = AlmaScraper(timeout=args.timeout, progress=progress)
    
    # Create organized output folder structure if not specified
    if not args.out:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_dir = Path("output") / timestamp
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine output filename based on options
        if args.full_catalog:
            filename = "full_catalog.json"
        elif args.branch_title:
            safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in args.branch_title)
            filename = f"{safe_name}.json"
        else:
            filename = "courses.json"
        
        out_path = output_dir / filename
        progress_path = str(output_dir / "progress.json")
    else:
        out_path = Path(args.out)
        progress_path = args.progress_file if args.progress_file else str(out_path.parent / "progress.json")
    
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
    result = scraper.scrape(options)

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


if __name__ == "__main__":
    main()

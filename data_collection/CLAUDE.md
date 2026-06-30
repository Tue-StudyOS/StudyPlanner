# CLAUDE.md — data_collection

Project instructions for the ALMA course-catalog scraper. Read this before
changing anything under `data_collection/`. For runnable commands see
[`QUICKSTART.md`](QUICKSTART.md); for environment setup see [`SETUP.md`](SETUP.md).

## What this is

A standalone Python scraper for the public ALMA course catalog at
`alma.uni-tuebingen.de`. It crawls the JSF catalog tree, fetches course detail
pages, and writes a JSON file. That JSON is then turned into the D1 seed by
`backend/scripts/import_alma_json_to_d1.py` (a separate step — the scraper does
not touch the database).

- `alma/scraper.py` — `AlmaScraper` (session, JSF navigation, parsing) + pure
  parse helpers.
- `alma/cli.py` — argparse entry point (`python -m alma.cli`), single-period and
  multi-period orchestration.
- Output: `output/<timestamp>/courses_multi_semester.json` (multi-period) or
  `courses.json` (single).

## The two catalog trees (important)

ALMA exposes the same courses through two different trees of the public
`showCourseCatalog-flow`:

1. **VVZ** — "Gesamtverzeichnis Lehrveranstaltungen Informatik". A flat-ish
   per-faculty listing. Includes department-wide offerings (Oberseminare,
   Kolloquien, info events, Mathe-Vorkurs) that are **not** tied to any degree
   module. None of those award ECTS.
2. **studiesOffered** — degree programs (B.Sc./M.Sc. ...). Each program tree is
   `[Modul] <study-area> → [Veranstaltungskonto] → [Veranstaltungsgruppe] (N CP)
   → [Veranstaltung]`. It lists courses **cross-listed from other faculties**
   (KOG, GTCNEURO, MEDZ, BIOINF) that count toward a study area but are absent
   from the VVZ Informatik branch.

Neither tree is a superset of the other, so the scraper crawls **both**: the VVZ
branch (`INFORMATICS_BRANCH_CHAIN`) plus the degree-program branches
(`PROGRAM_BRANCH_CHAINS`: M.Sc. CS, B.Sc. Informatik, M.Sc. ML). Courses are
deduplicated by `unit_id`; `ScrapeOptions.skip_unit_ids` stops later branches
from re-fetching detail pages a previous branch already got. `--no-programs`
falls back to VVZ-only. See `cli._scrape_period_branches`.

The logged-in "Studienplaner mit Modulplan" (`studyPlanner-flow`) returns **403
anonymously** — do not target it. The studiesOffered tree above is the
anonymously-reachable equivalent.

### übK external offerings are pruned

Each degree program has a übK ("überfachliche Kompetenzen") module whose
"Außerfakultäre Angebote / übK - Anrechnung auf Curriculum prüfen" container
holds the *entire* external catalog — Fremdsprachenzentrum, Universitäts-
bibliothek, Transdisciplinary Course Program, ZDV, etc. None of those are
Informatik courses and none carry an Informatik study-area code. ALMA
pre-expands this container inline for **some** semesters (e.g. WiSe 2022/23,
SoSe 2023) and not others, so a naive crawl produced ~480 courses for those
periods versus ~130 for the rest. The scraper refuses to expand that container
(matched by `EXTERNAL_UEBK_TITLE_MARKER` in `_crawl_catalog`) so every period
stays consistently slim. Pass `--include-uebk` to crawl it anyway.

## Period ids ↔ semesters

Period ids are opaque ALMA ints; the mapping is **not** chronological by number:

| id | semester | id | semester |
|----|----------|----|----------|
| 225 | SoSe 2022 | 233 | WiSe 2022/23 |
| 226 | SoSe 2023 | 234 | WiSe 2023/24 |
| 227 | SoSe 2024 | 235 | WiSe 2024/25 |
| 228 | SoSe 2025 | 236 | WiSe 2025/26 |
| 229 | SoSe 2026 | | |

`--from-semester LABEL` selects every period at or after `LABEL`
(`parse_semester_tuple` understands e.g. `"Sommer 2026"`, `"Winter 2022/23"`).
Deep-path `title:NNNN` ids differ per period, so branches are rediscovered each
period by title chain via `find_branch_permalink`.

## Study-area attribution (how courses link to INFO-INFO etc.)

Each course detail page has a "Module / Studiengänge" table; the scraper stores
those codes as the `_categories_json` course field. The importer joins them to
`study_areas.code`. Codes mostly match directly (M.Sc. CS: `INFO-BASIS`,
`INFO-FOKUS`, `INFO-INFO`, `INFO-PRAK`, `INFO-TECH`, `INFO-THEO`), but some need
aliasing — handled in `import_alma_json_to_d1.py`:

- M.Sc. ML detail pages use `MACH-*`; seeded study areas are `ML-*`
  (`MACH-FML→ML-FOUND`, `MACH-DTML→ML-DIVERSE`, `MACH-GCS→ML-CS`, `MACH-EP→ML-EXP`).
- B.Sc. Wahlpflicht appears as `INFM####` (`INFM3110→PRAK`, `INFM3410→THEO`,
  `INFM3310→TECH`, `INFM2510→INFO`).

Enumeration is the hard part: once a cross-listed course is scraped and its
detail page fetched, the existing category-code join attributes it. B.Sc.
*compulsory* modules (Mathe, Teamprojekt) carry no Wahlpflicht code, so they are
enumerated but not category-linked (known gap).

## Gotchas

- **Mojibake**: ALMA text often arrives UTF-8-as-cp1252. Use `repair_mojibake`
  before comparing/printing titles; never assume clean text.
- **Politeness**: keep `polite_delay` between requests; do not parallelize.
- **Progress**: `tqdm` shows an outer "semesters" bar and an inner per-branch
  detail bar. Log lines go through `tqdm.write` so they don't corrupt the bars;
  `--quiet` disables both. `progress.json` is still written every course.
- Coverage is scoped to the three Informatik programs above. Adding e.g.
  Medieninformatik (which is where `User Experience` lives) is a one-entry
  addition to `PROGRAM_BRANCH_CHAINS` plus any needed code aliases.

## Conventions

Follow the repo-wide `AGENTS.md`. Python: explicit type hints, small pure
helpers, comments explain *why*. New scraper logic should be exercised by a real
run against one period before merging (no DB write needed).

# Repository Overhaul Report — July 2026

## Scope

This overhaul reviewed the tracked repository, the production D1 catalog, the
course-detail data path, the semester planner, calendar export, migration safety,
and frontend dependencies. Work was performed on
`overhaul/calendar-course-data`; `main` was not modified directly.

## Baseline findings

- The working tree was clean on `main`.
- The repository tracked 475 files and 80,134,686 bytes.
- Two obsolete catalog snapshots accounted for about 17.1 MB.
- `backend/migrations/0019_testdata_multi_tag_courses.sql` put fake catalog data
  in the production migration chain. Production had subsequently removed those
  rows through migration `0022`, but fresh databases still had to insert and
  remove them.
- The production D1 contained 1,158 course rows across nine periods. ALMA uses
  the same number for separate lecture and exercise rows in 52 period/number
  groups. The all-period API selected one representative row and therefore
  dropped the companion row's appointments.
- Example: `INFM1110` returned only the lecture row and 23 appointments although
  the matching exercise row contained 32 tutorial options.
- The D1 retained current ALMA values in `parallel_group_fields`, but importer
  label mismatches left normalized language and participant-limit columns empty.
- Calendar export used broad semester dates instead of appointment recurrence
  bounds, ignored cancellation dates, used unstable array indexes, and exported
  administrative dates such as exam corrections.
- Frontend dependency audit reported one high and three low vulnerabilities.

## Implemented changes

### Logical courses and complete data

- Logical identity now combines stable course numbers with normalized titles, so
  lecture/exercise variants merge while unrelated generic numbers such as `INF`
  stay separate.
- Period and all-period catalog responses merge every companion row from the
  selected period.
- `sourceCourseIds` preserves aliases for existing favorites and semester plans;
  the frontend migrates saved aliases to the canonical id without losing courses.
- Course detail stays on the requested period instead of silently switching to
  the newest semester.
- Rich schedule entries now expose stable appointment/group ids, source ids,
  recurrence bounds, notes, cancellation dates, and calendar relevance.
- Detail responses combine content, prerequisites, exams, links, responsible
  staff, participant limits, regulation mappings, and non-duplicate ALMA fields
  from all companion rows.
- Current ALMA labels for type, language, and participant limits are normalized
  by the importer. API fallbacks read `parallel_group_fields`, so production data
  is complete before the next catalog reseed.

### Course detail and tutorials

- The detail view separates recurring lectures, tutorial/exercise alternatives,
  exam dates, and other published dates.
- Every tutorial option is visible with weekday/date range, time, room, group
  metadata, notes, and cancellations.
- In the planner detail modal, users select the tutorial that remains in their
  weekly plan. Legacy hidden-slot ids remain compatible.
- The mini calendar shows recurring teaching slots only; exams stay readable as
  date cards instead of being mixed into the weekly grid.
- Additional public ALMA fields are displayed only when populated. Existing
  empty-state behavior remains limited to the Moodle/ILIAS link.

### Calendar workflow

- ICS events use stable appointment-based UIDs.
- Actual ALMA `startsOn`/`endsOn` values define recurrence whenever available.
- Cancellation dates become `EXDATE` entries.
- Hidden tutorial alternatives and legacy hidden-slot ids are respected.
- Administrative dates such as exam corrections, exam reviews, and tutor
  training are excluded from export but remain available under other dates in
  course detail.
- Duplicate all-day exam entries are suppressed when a timed appointment exists.
- The calendar includes `METHOD:PUBLISH` and a semester-specific calendar name.

### Repository and operational hygiene

- Removed obsolete `backend/data/Alma_courses.json` and
  `backend/data/courses.json`; generated scraper output is ignored.
- Removed production migration `0019_testdata_multi_tag_courses.sql`. Optional
  test data remains in `backend/scripts/seed_test_courses.sql`; Wrangler reports
  no pending production migrations.
- Updated Cloudflare/database guidance to the active `studyplanner-db` binding.
- Updated frontend lock data to patched Vite, React Router, and Babel releases;
  `npm audit` now reports zero vulnerabilities.
- Public catalog responses now advertise short browser and edge cache lifetimes
  with stale-while-revalidate support.

## Production data verification

After backend deployment, the public API returned for `INFM1110`:

- one logical course (`id=931`)
- source ids `931` and `960`
- types `Vorlesung` and `Übung`
- 55 combined schedule entries
- 33 tutorial-like entries
- five administrative entries marked as not calendar-relevant
- offering history from Winter 2022/23 through Winter 2025/26

Fallback verification against production D1 also confirmed:

- `MAT-95-41` exposes `language=deutsch` and participant limits of 100/30.
- `GTCNEURO` exposes `language=englisch` and a participant limit of 65.

## Size and build impact

- Tracked size after cleanup: about 63.0 MB.
- Reduction: 17,129,138 bytes (21.4%).
- The remaining `backend/data/alma.sqlite` is about 60.3 MB and now accounts for
  most tracked bytes. It remains because matching/export tooling and curriculum
  reference data still depend on it.
- Baseline main frontend bundle: 70.51 kB gzip.
- Updated main frontend bundle: 72.43 kB gzip.
- Course-detail chunk increased from 12.50 kB to 13.74 kB gzip for the complete
  schedule/tutorial UI.

## Validation

- Frontend: 306 tests passed.
- Frontend lint: passed with no warnings.
- Frontend typecheck and production build: passed.
- Backend: 125 tests passed.
- Data collection: 19 tests passed.
- ALMA parser: 3 tests passed.
- MCP integration: 11 tests passed; build passed.
- Cloudflare config verification: passed.
- Frontend dependency audit: zero vulnerabilities.
- Production migration check: migrations 0031 and 0032 applied successfully.

Deployment verification:

- Backend Worker version: `7b19edbd-bf82-4f31-9e15-26bc10753be1`.
- Frontend preview: <https://overhaul-calendar-course-dat.studyplaner.pages.dev>.
- Preview page and merged catalog API both returned HTTP 200.

## Remaining focused follow-ups

1. Validate and re-import the full archived-period re-scrape to restore
   historical ECTS fields without dropping any catalog period.
2. Retain the legacy SQLite curriculum/matching source (about 60.3 MB) while
   collection and matching tooling still depend on it.
3. Split remaining large hotspots, especially
   `backend/src/services/course_catalog.py`,
   `frontend/src/features/courses/components/Overview.tsx`, and
   `frontend/src/features/planner/components/SemesterPlanner.tsx`, when those
   features next change. Their current behavior is tested, so a structural-only
   rewrite was intentionally not mixed into this data-correctness overhaul.

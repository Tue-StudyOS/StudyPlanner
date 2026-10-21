# Catalog calendar and tree-credit release, 2026-10-12

## Live database reconciliation

Fetched `origin/main` and exported the active production `studyplanner-db`
before preparing the release. The database contained 1,525 courses across ten
periods, including 148 courses in Winter 2026/27 (period 237). It had changed
since the initial local preview, including newer catalog and user data.

Staging the incremental ALMA import against that fresh export retained all 148
course IDs and the context of 37 saved tutorial selections. Other periods and
user data remained identical. The live course records already matched the
scrape, so production received a smaller schedule-only patch:

- Fill weekday, weekday index, and cancellation text on 436 appointments.
- Add 641 cancellation dates for Winter 2026/27.
- Preserve every course, catalog node, course field, user row, and other period.

The patch was generated from the existing importer output, tested against a
copy of the fresh export, and applied to the existing database. Appointment
updates were conditional on their previous schedule values; cancellation
inserts were idempotent and split below D1's compound SELECT limit. No database
binding, schema, or runtime compatibility date changed.

A second production export matched the staged patch across every application
table. SQLite integrity checks passed. Both exports and validation artifacts
remain in ignored `backend/.tmp/`; they contain private data and must not be
committed or distributed.

## Application changes

Course calendar export offers no tutorial, one tutorial, or all tutorials,
with separate exam and resit choices. Weekly events include cancelled-date
exceptions. Cancellation labels use neutral styling.

Missing explicit ECTS values fall back to credit-bearing ALMA tree groups.
Credits resolve for the selected study program; unmatched or conflicting
published values remain visible with a qualification and do not enter planner
totals as assumed credits. No course-specific credit overrides are used.

## Validation

- Backend: 262 tests passed.
- Frontend: 397 tests passed, five skipped; lint and build passed.
- Cloudflare binding/configuration guard passed.
- Worker deployment dry run passed with the existing production binding.
- Local API, detail hook, facts, and card checks covered INF3433 with Machine
  Learning and Informatik selected.

Deploy the merged main checkout using the existing Worker and Pages commands
in [the deployment guide](cloudflare-setup.md), then check health, same-origin
catalog APIs, the tree-credit examples, and calendar export data on production.

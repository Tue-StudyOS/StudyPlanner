# TODO

Open follow-ups that need a human decision or a separate change. Remove items
when they are resolved.

## Catalog / curriculum data

- **ML master badges don't link.** ALMA's scraped category codes for the
  Machine Learning M.Sc. are `MACH-*` (`MACH-FML`, `MACH-DTML`, `MACH-GCS`,
  `MACH-EP`), but the seeded `study_areas` use `ML-*` (`ML-FOUND`,
  `ML-DIVERSE`, `ML-CS`, `ML-EXP`). Confirm the semantic mapping (e.g.
  `MACH-FML` -> `ML-FOUND`?) and add an alias step to the seed rebuild in
  `backend/scripts/import_alma_json_to_d1.py`.
- **Old-period ECTS depends on the re-scrape.** Archived semesters were
  scraped with an older parser, so `details.fields` / `Kurzkommentar` (the
  ECTS source) are empty for periods before Winter 2025/26. Re-scrape +
  re-import fixes it (`--continue` with `--redo-periods` in
  `data_collection/alma/cli.py`).
- **Only 12 `curriculum_modules` exist.** Module codes/ECTS come from the
  legacy `backend/data/alma.sqlite` export, not from migrations or the
  multi-period import. A fresh D1 built from migrations + seed would have no
  `study_areas`/`curriculum_modules` at all. Decide on a proper source
  (module handbook import?) and a migration/seed home for the reference data.

## Migrations / infrastructure

- **`0019_testdata_multi_tag_courses.sql` must not reach production.**
  It inserts 8 fake test courses; it has not been applied to
  `studyplanner-db`, but the next `npm run db:migrate:remote` would run it.
  Move it out of `backend/migrations/` (or guard it) before anyone migrates.
  Until then, apply new migrations individually via
  `wrangler d1 execute studyplanner-db --remote --file migrations/<file>.sql`.
- **Delete `studyplaner-db-test`** (`297f7a28-9069-431d-b989-49acf2537513`)
  once the new database has been verified long enough
  (see `docs/cloudflare-runtime-config.md`).

# TODO

Open follow-ups that need a human decision or a separate change. Remove items
when they are resolved.

## Catalog / curriculum data

- **Old-period ECTS depends on the re-scrape.** Archived semesters were
  scraped with an older parser, so `details.fields` / `Kurzkommentar` (the
  ECTS source) are empty for periods before Winter 2025/26. Re-scrape +
  re-import fixes it (`--continue` with `--redo-periods` in
  `data_collection/alma/cli.py`).

## Migrations / infrastructure

- **Delete `studyplaner-db-test`** (`297f7a28-9069-431d-b989-49acf2537513`)
  once the new database has been verified long enough
  (see `docs/cloudflare-runtime-config.md`).

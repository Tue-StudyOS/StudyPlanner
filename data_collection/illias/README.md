# ILIAS Course Scraper

This scraper logs into ILIAS, reads the Informatik repository page, and stores
course metadata that is visible before joining a course. It must not enrol,
join, subscribe, or otherwise change membership state.

## Workflow

```powershell
cd data_collection
py -3 -m illias.cli scrape --out-json output/illias_courses.json
py -3 -m illias.cli match --period-label "Sommer 2026" --out-json output/illias_matches.json
```

The default SQLite output is `data_collection/output/illias.sqlite`.

The matcher is conservative:

- exact ALMA course numbers win immediately when unique
- duplicate course-number matches are narrowed by instructor names
- title matches require multiple meaningful overlapping words
- ambiguous cases are stored as unresolved instead of guessed

The credentials file is read from `data_collection/illias/.env` by default and
must contain the keys shown in `.env.template`.


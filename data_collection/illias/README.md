# ILIAS Course Scraper

This scraper logs into ILIAS, reads the Informatik repository page, and stores
course metadata that is visible before joining a course. It must not enrol,
join, subscribe, or otherwise change membership state.

## Workflow

```powershell
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli scrape --out-json data_collection/output/illias_courses.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli match --period-label "Sommer 2026" --out-json data_collection/output/illias_matches.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli export-sql --out backend/data/seed_illias.sql
```

The default SQLite output is `data_collection/output/illias.sqlite`.

For a smoke run without fetching every course detail:

```powershell
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli scrape --max-courses 5 --out-json data_collection/output/illias_smoke.json
```

The matcher is conservative:

- exact ALMA course numbers win immediately when unique
- duplicate course-number matches are narrowed by instructor names
- title matches require multiple meaningful overlapping words
- ambiguous cases are stored as unresolved instead of guessed

The credentials file is read from `data_collection/illias/.env` by default and
must contain the keys shown in `.env.template`.

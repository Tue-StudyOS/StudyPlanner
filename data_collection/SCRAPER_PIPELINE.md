# Scraper Update Pipeline

Run commands from the repo root unless noted.

## 1. Scrape ALMA

```powershell
cd data_collection
uv sync
uv run python -m alma.cli --details --from-semester "Sommer 2022"
cd ..
```

The scraper writes JSON under data_collection/output/. It does not update the
tracked alma.sqlite automatically. Review the output and use the
[in-place ALMA import](../docs/cloudflare-runtime-config.md#catalog-refresh) for
production; include every period to retain.

## 2. Scrape Moodle

```powershell
python -m data_collection.moodle.cli `
  --category-url "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235" `
  --match-sqlite backend/data/alma.sqlite `
  --out data_collection/output/moodle_courses.json `
  --matches-out data_collection/output/moodle_matches.json `
  --pretty
```

The matcher prints accepted and unmatched counts. If `unmatched` is non-zero,
review the remaining cases in the local HTML helper, save overrides in the
browser, stop the server with `Ctrl+C`, and apply the saved overrides:

```powershell
python -m data_collection.moodle.review serve `
  --matches data_collection/output/moodle_matches.json `
  --alma-db backend/data/alma.sqlite `
  --out data_collection/output/moodle_manual_overrides.json `
  --open

python -m data_collection.moodle.review apply `
  --matches data_collection/output/moodle_matches.json `
  --overrides data_collection/output/moodle_manual_overrides.json `
  --out data_collection/output/moodle_matches.json
```

If every Moodle course is already accepted, skip the review step. Then generate
the D1 seed SQL:

```powershell
python backend/scripts/import_moodle_json_to_d1.py `
  --input data_collection/output/moodle_matches.json `
  --out-sql backend/data/seed_moodle_links.sql
```

The Moodle seed records every Moodle row and match decision. Visible
`course_learning_links` are inserted only when the matched ALMA course exists in
the target D1 snapshot, so refresh ALMA before applying Moodle on stale local DBs.

## 3. Scrape ILIAS

Create `data_collection/illias/.env` from `.env.template`, then run:

```powershell
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli scrape --out-json data_collection/output/illias_courses.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli match --period-label "Sommer 2026" --out-json data_collection/output/illias_matches.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli export-sql --out backend/data/seed_illias.sql
```

## 4. Update D1

Prepare a local catalog using the [local setup](../docs/cloudflare-development.md)
first. Then apply the generated learning-platform supplements locally:

```powershell
cd backend
npx wrangler d1 execute DB --local --file data/seed_moodle_links.sql
npx wrangler d1 execute DB --local --file data/seed_illias.sql
```

Production imports require a reviewed input and backup. Do not replace --local
with --remote on the SQLite bootstrap seed: it is not a production refresh.
Use the [catalog refresh guide](../docs/cloudflare-runtime-config.md#catalog-refresh)
for ALMA, then apply reviewed supplemental seeds to the same DB. Data-only changes
normally do not require a code deployment; use the [deployment guide](../docs/cloudflare-setup.md)
when code or configuration changes too.

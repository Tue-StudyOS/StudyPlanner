# Scraper Update Pipeline

Run commands from the repo root unless noted.

## 1. Scrape ALMA

```powershell
uv run python -m alma_scraper.cli --details --from-semester "Sommer 2022"
python backend/scripts/export_sqlite_to_d1.py --skip-schema --data-out backend/.tmp/d1-seed.sql
```

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

```powershell
npm run db:verify-config
npm run db:migrate:local
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
npx wrangler d1 execute DB --local --file data/seed_moodle_links.sql
npx wrangler d1 execute DB --local --file data/seed_illias.sql
```

Use `--remote` instead of `--local` only when intentionally updating the deployed
`studyplanner-db` binding. After remote data updates, deploy the Worker and
frontend from the repo root:

```powershell
npm run deploy:backend
cd frontend
npm run build
npx wrangler pages deploy dist --project-name studyplaner
```

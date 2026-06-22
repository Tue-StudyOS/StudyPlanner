# Scraper Pipeline

Short update flow from the repo root.

## ALMA catalog

```powershell
uv run python -m alma_scraper.cli --details --from-semester "Sommer 2022"
python backend/scripts/import_alma_json_to_d1.py --input data_collection/output/<run>/courses_multi_semester.json --out-sql backend/data/seed_alma_catalog.sql
```

## Moodle links

```powershell
python -m data_collection.moodle.cli `
  --category-url "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235" `
  --match-sqlite backend/data/alma.sqlite `
  --out data_collection/output/moodle_courses.json `
  --matches-out data_collection/output/moodle_matches.json `
  --pretty

python backend/scripts/import_moodle_json_to_d1.py `
  --input data_collection/output/moodle_matches.json `
  --out-sql backend/data/seed_moodle_links.sql
```

## ILIAS metadata

Create `data_collection/illias/.env` from `.env.template` first.

```powershell
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli scrape --out-json data_collection/output/illias_courses.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli match --period-label "Sommer 2026" --out-json data_collection/output/illias_matches.json
uv run --no-project --with beautifulsoup4 --with requests python -m data_collection.illias.cli export-sql --out backend/data/seed_illias.sql
```

## Apply to D1

```powershell
npm run db:verify-config
npm run db:migrate:local
cd backend
npx wrangler d1 execute DB --local --file data/seed_alma_catalog.sql
npx wrangler d1 execute DB --local --file data/seed_moodle_links.sql
npx wrangler d1 execute DB --local --file data/seed_illias.sql
```

Use `--remote` instead of `--local` only when intentionally updating the active
Cloudflare D1 database.

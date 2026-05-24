# StudyPlaner API Backend

This folder now contains the Cloudflare Worker API and the D1 migration assets.

## Structure

```text
backend/
├── data/                    # local source data kept in git for migration work
├── migrations/              # D1 schema migrations
├── scripts/                 # local helper scripts, e.g. SQLite -> D1 export
├── src/                     # Cloudflare Worker source
├── pyproject.toml
└── wrangler.toml
```

## Worker routes

- `GET /` – service metadata
- `GET /health` – health check plus D1 reachability
- `GET /api/courses?limit=50` – lightweight course list from D1
- `GET /api/courses/<id>` – course detail with related rows from D1
- `GET /api/study-programs` – supported official PO 2021 study program list from D1

## Local development

```bash
cd backend
npx wrangler dev
```

## D1 workflow

Apply the schema migration:

```bash
cd backend
npx wrangler d1 migrations apply studyplaner-db --local
```

Create a data-only SQL dump from the tracked SQLite database plus the official PO 2021 JSON seeds from `einzupflegene_po/`:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

If the PO 2021 source JSON changes, regenerate the SQL migration as well:

```bash
python backend/scripts/generate_po2021_migration.py
```

Import the generated dump into the local D1 database:

```bash
cd backend
npx wrangler d1 execute studyplaner-db --local --file .tmp/d1-seed.sql
```

## Notes

- The first D1 migration intentionally excludes the SQLite FTS tables.
- `backend/data/alma.sqlite` remains the local source for the catalog/course data inside generated D1 imports.
- `backend/scripts/export_sqlite_to_d1.py` also appends the supported PO 2021 study-program/regulation seed from `einzupflegene_po/`.
- The frontend is not fully switched to this API yet; it still uses mock/bootstrap JSON for now.

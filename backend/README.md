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
- `GET /api/study-programs` – study program list from D1

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

Create a data-only SQL dump from the tracked SQLite database:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Import the generated dump into the local D1 database:

```bash
cd backend
npx wrangler d1 execute studyplaner-db --local --file .tmp/d1-seed.sql
```

## Notes

- The first D1 migration intentionally excludes the SQLite FTS tables.
- `backend/data/alma.sqlite` remains the local source for generating D1 imports.
- The frontend is not fully switched to this API yet; it still uses mock/bootstrap JSON for now.

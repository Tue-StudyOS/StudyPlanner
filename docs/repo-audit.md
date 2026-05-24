# Repo Audit

## Frontend

- The frontend already lives in `frontend/`.
- Tooling is in place:
  - `frontend/package.json`
  - `frontend/vite.config.ts`
  - `frontend/tsconfig.json`
  - `frontend/tsconfig.app.json`
  - `frontend/tsconfig.node.json`
- `npm run build` works after installing dependencies.
- The public catalog now reads from the Worker API instead of `backend/data/courses.json`.
- `backend/data/courses.json` remains only as a legacy reference file and is not part of the active frontend runtime path.
- `frontend/public/_redirects` was added for Cloudflare Pages SPA routing.

## Backend

- The repository did not previously contain a deployable HTTP backend.
- A minimal Cloudflare Worker backend now exists in `backend/src/`.
- The Worker exposes:
  - `/health`
  - `/api/courses`
  - `/api/courses/<id>`
  - `/api/study-programs`
- CORS is configured through `ALLOWED_ORIGINS`.
- `backend/wrangler.toml` prepares the Worker and the `DB` D1 binding.

## Database

- The real source data currently lives in `backend/data/alma.sqlite`.
- The SQLite database contains the normalized ALMA schema used for the D1 migration.
- `backend/migrations/0001_initial.sql` is generated from that SQLite schema.
- The initial D1 migration excludes the SQLite FTS virtual tables to keep the first Cloudflare step small and predictable.
- `backend/scripts/export_sqlite_to_d1.py` can export a data-only SQL dump for D1 imports.

## Environment and deployment

- `.env.example` and `frontend/.env.example` document the expected variables.
- `package.json` at the repo root provides helper scripts for frontend build, Worker dev, and D1 migration commands.
- `docs/cloudflare-setup.md` documents the manual Cloudflare setup flow.

## Risks / open points

- The transcript/progress area still uses temporary example completed-course bootstrap data.
- The first D1 migration does not yet include full-text search.
- End-user authentication, favorites persistence, and study-progress storage are still open product and backend topics.
- The local scraper/import flow remains local by design and is not deployed to Cloudflare.

## Recommended next steps

1. Create the Cloudflare Pages and Worker projects.
2. Create the D1 database and set the real `database_id` in `backend/wrangler.toml`.
3. Apply `backend/migrations/0001_initial.sql`.
4. Export/import the existing SQLite data into D1.
5. Finish the signed-out visitor flow and remaining personal-data cutovers.
6. Design the later user-data model for favorites, progress, and authentication.

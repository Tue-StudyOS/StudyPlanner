# StudyPlaner

## Architecture

- Frontend: React + Vite in `frontend/`
- API: Cloudflare Worker in `backend/src/`
- Database: Cloudflare D1 with schema migrations in `backend/migrations/`
- Data collection: local Python tooling in `data_collection/`
- Repository: GitHub monorepo

## Current migration status

The repository is prepared for a Cloudflare move with minimal application changes:

- The frontend can be deployed from `frontend/` to Cloudflare Pages.
- A minimal Cloudflare Worker API exists in `backend/`.
- The D1 schema is generated from `backend/data/alma.sqlite`.
- A local export script can create a D1 seed dump from the existing SQLite data.

The public catalog now reads from the Worker API and D1. Remaining temporary bootstrap data is limited to personal-progress example state; see `docs/mock-data-status.md`.

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Frontend build

```bash
cd frontend
npm run build
```

### Backend Worker

```bash
cd backend
npx wrangler dev
```

### D1 migrations

```bash
cd backend
npx wrangler d1 migrations apply studyplaner-db --local
```

### Export the local SQLite data for D1

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Then import the generated file with Wrangler:

```bash
cd backend
npx wrangler d1 execute studyplaner-db --local --file .tmp/d1-seed.sql
```

## Deployment

- Frontend: Cloudflare Pages from `frontend/`
- Backend: Cloudflare Worker from `backend/`
- Database: Cloudflare D1 bound as `DB`

## Environment variables

- Root examples: `.env.example`
- Frontend example: `frontend/.env.example`
- Worker variables: `backend/wrangler.toml`

## Further documentation

- Cloudflare development: `docs/cloudflare-development.md`
- Cloudflare setup: `docs/cloudflare-setup.md`
- Mock-data status: `docs/mock-data-status.md`
- Repo audit: `docs/repo-audit.md`
- Backend details: `backend/README.md`

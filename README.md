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

Use Windows commands from the repository root:

### 1. Pull the real source database with Git LFS

Install Git LFS once, then fetch the tracked database files:

```powershell
git lfs install
git lfs pull
```

If Git LFS is not installed yet, install it first with `winget` or your preferred package manager.

### 2. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 3. Apply the local D1 schema

```powershell
cd backend
npx wrangler d1 migrations apply studyplaner-db-test --local
```

### 4. Generate seed SQL from SQLite

```powershell
python scripts/export_sqlite_to_d1.py --data-out .tmp/d1-seed.sql
```

### 5. Import the seed into the local D1 database

```powershell
npx wrangler d1 execute studyplaner-db-test --local --file .tmp/d1-seed.sql
cd ..
```

### Daily workflow

Run the app in two terminals.

Terminal 1, frontend:

```powershell
cd frontend
npm run dev
```

Terminal 2, Worker API:

```powershell
cd backend
npx wrangler dev
```

### Frontend build

```powershell
cd frontend
npm run build
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


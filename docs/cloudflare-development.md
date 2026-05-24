# Cloudflare Development

Short daily workflow for teammates and agents.

## Current setup

- Branch for Cloudflare work: `cloudflare-migration-test`
- Frontend: Cloudflare Pages from `frontend/`
- Backend: Cloudflare Worker from `backend/`
- Database: Cloudflare D1 bound as `DB`
- Public catalog status: the frontend catalog now uses the Worker API and D1
- Remaining mock/bootstrap data is limited to temporary personal-progress example state; see `docs/mock-data-status.md`

## Local development

### Frontend

```bash
npm --prefix frontend run dev
```

### Backend Worker

```bash
cd backend
npx wrangler dev
```

## D1 workflow

Apply local migrations:

```bash
cd backend
npx wrangler d1 migrations apply studyplaner-db --local
```

Create a D1 seed from the tracked SQLite source:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Import it into local D1:

```bash
cd backend
npx wrangler d1 execute studyplaner-db --local --file .tmp/d1-seed.sql
```

## Deploy workflow

### Push branch changes

```bash
git push origin cloudflare-migration-test
```

### Deploy the Worker

```bash
npm run deploy:backend
```

### Frontend deploy

If Pages is already connected to this repository/branch, pushing the branch is enough to trigger a new deploy.

## Required config

- Frontend env example: `frontend/.env.example`
- Shared env example: `.env.example`
- Worker config: `backend/wrangler.toml`

Important variables:

- `VITE_API_BASE_URL`
- `ALLOWED_ORIGINS`
- D1 binding `DB`

## Smoke tests

Run these after deploy:

```bash
curl <worker-url>/health
curl "<worker-url>/api/courses?limit=2"
curl <worker-url>/api/study-programs
```

Also verify in the browser:

- Pages frontend loads
- direct route refresh works
- frontend catalog and public data views can reach the configured API

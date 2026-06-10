# Cloudflare Development

Short daily workflow for teammates and agents.

## Current setup

- Use short-lived feature branches for work under test, then merge into `main` once production-ready.
- Frontend: Cloudflare Pages from `frontend/`
- Backend: Cloudflare Worker from `backend/`
- Database: Cloudflare D1 bound as `DB`, currently `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`)
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

Apply local migrations through the checked `DB` binding:

```bash
npm run db:verify-config
npm run db:migrate:local
```

Create a D1 seed from the tracked SQLite source:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Import it into local D1:

```bash
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
```

## Deploy workflow

### Push branch changes

```bash
git push origin <feature-branch>
```

### Deploy the Worker

```bash
npm run db:verify-config
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
- D1 binding `DB` to `studyplaner-db-test` until the approved production cutover

The frontend still expects `VITE_API_BASE_URL` to be set during Pages builds. The checked Pages config and production env file point at `https://studyplanner-api.ben-tischberger.workers.dev`. As a production safeguard, the client also falls back to that URL only when it is running on `studyplaner.pages.dev` or a `*.studyplaner.pages.dev` preview host.

For Pages preview deployments, `ALLOWED_ORIGINS` should allow both the production Pages origin and preview subdomains, for example:

```text
https://studyplaner.pages.dev,https://*.studyplaner.pages.dev
```

## Config guard

Before deploys or after touching Cloudflare config, run:

```bash
npm run db:verify-config
```

See `docs/cloudflare-runtime-config.md` for the canonical active resource names and the explanation of what is safe to commit.

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

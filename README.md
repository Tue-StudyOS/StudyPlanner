# StudyPlanner

## Quick access

- Deployed frontend (Cloudflare Pages): `https://studyplaner.pages.dev`
- Canonical API Worker: `https://studyplanner-api.ben-tischberger.workers.dev`

Use `https://studyplaner.pages.dev` when you want to test the currently deployed app with your existing deployed account.

## Architecture

- Frontend: React + Vite in `frontend/`
- API: Cloudflare Worker in `backend/src/`
- Database: Cloudflare D1 with schema migrations in `backend/migrations/`
- Data collection: local Python tooling in `data_collection/`
- Repository: GitHub monorepo

## Current database/auth direction

- `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`) is the current active D1 runtime database.
- `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`) is reserved for a later production cutover and must not be used yet without explicit approval.
- User-owned data is reduced to exactly three tables: `user_auth`, `user_state`, and `user_progress`.
- Server-side sessions are removed. Auth uses stateless signed bearer tokens with the Worker secret `AUTH_TOKEN_SECRET`.
- Logout deletes the client-side token only; immediate server-side token revocation is intentionally not available without reintroducing session/revocation state.

## Testing and local development

### Choose the right test mode

1. **Deployed app** — use `https://studyplaner.pages.dev`
2. **Local frontend against the deployed API** — best when you want to test this frontend branch with your existing deployed account
3. **Full local stack** — needed when you want isolated local auth/users and a local D1 database

### 1. Test the deployed app

Open:

```text
https://studyplaner.pages.dev
```

That is the current Pages deployment.

### 2. Test this frontend branch locally with the deployed backend/account

This is the easiest way to test frontend changes while keeping your existing deployed login.

Create `frontend/.env.local` (gitignored) with:

```bash
VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Notes:

- your existing deployed account works here because the local frontend calls the same Worker as `studyplaner.pages.dev`
- changes to favorites, planner data, completed courses, or profile data affect the deployed test runtime DB
- restart Vite after adding or changing `frontend/.env.local`

### 3. Test the full stack locally

Use this when you want a separate local Worker plus a separate local D1 state.

#### Prepare the local D1 database

From the repo root:

```bash
npm run db:verify-config
npm run db:migrate:local
npm run db:export:d1
```

Import the generated seed into the local D1 database:

```bash
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
```

#### Configure local auth

Create `backend/.dev.vars` (gitignored) with at least:

```bash
AUTH_TOKEN_SECRET=replace-this-with-a-long-random-local-dev-secret
```

Important:

- `npx wrangler login` only authenticates the CLI against your Cloudflare account
- `npx wrangler login` does **not** create `AUTH_TOKEN_SECRET`
- if you change `backend/.dev.vars`, restart `npx wrangler dev`

#### Start backend and frontend

Terminal 1:

```bash
cd backend
npx wrangler dev --persist-to .wrangler/state
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Notes:

- on `localhost`, the frontend falls back to `http://localhost:8787` when `VITE_API_BASE_URL` is not set
- local users are stored in the local D1 state, not in the deployed database
- your deployed `studyplaner.pages.dev` credentials are therefore usually **not** available locally
- `--persist-to .wrangler/state` keeps local D1 data and locally created accounts across restarts

#### Local smoke tests

```bash
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/api/courses?limit=2"
curl http://127.0.0.1:8787/api/study-programs
```

### Frontend tests

Run before every commit that touches frontend code:

```bash
npm run test:frontend   # from the repo root, or: cd frontend && npm test
```

This runs all `frontend/tests/**/*.test.ts` files with the Node test runner.
Lint and typecheck via `npm run lint` and `npm run build` inside `frontend/`.

### Frontend build

```bash
cd frontend
npm run build
```

## D1 migrations

```bash
npm run db:verify-config
npm run db:migrate:local
```

## Export the local SQLite data for D1

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Then import the generated file with Wrangler through the checked `DB` binding:

```bash
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
```

## Remote safety checklist

Before any remote D1 rebuild or destructive migration:

1. Read current Cloudflare D1 state (`npx wrangler d1 list` and non-destructive count/schema queries).
2. Export/backup both `studyplaner-db-test` and `studyplanner-db` outside the repo.
3. Confirm `backend/wrangler.toml` still binds `DB` to `studyplaner-db-test` by running `npm run db:verify-config`.
4. Validate migrations and API flows locally.
5. Ask for explicit human approval before applying remote schema changes or switching to `studyplanner-db`.

## Deployment

- Frontend: Cloudflare Pages from `frontend/`
- Backend: Cloudflare Worker from `backend/`
- Database: Cloudflare D1 bound as `DB`

Deploy command after secrets are configured:

```bash
npm run db:verify-config
npm run deploy:backend
```

## Environment variables

- Root examples: `.env.example`
- Frontend example: `frontend/.env.example`
- Frontend local override: `frontend/.env.local` (gitignored)
- Worker variables: `backend/wrangler.toml`
- Worker local secrets: `backend/.dev.vars` (gitignored)
- Worker secret: `AUTH_TOKEN_SECRET` (set with `npx wrangler secret put AUTH_TOKEN_SECRET --name studyplanner-api`; never commit it)
- Runtime config reference: `docs/cloudflare-runtime-config.md`

## Further documentation

- Backend details: `backend/README.md`
- Authentication: `docs/authentication.md`
- Cloudflare runtime config: `docs/cloudflare-runtime-config.md`
- Cloudflare development: `docs/cloudflare-development.md`
- Cloudflare setup: `docs/cloudflare-setup.md`
- Mock-data status: `docs/mock-data-status.md`
- Repo audit: `docs/repo-audit.md`

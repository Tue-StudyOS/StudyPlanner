# StudyPlanner

## Architecture

- Frontend: React + Vite in `frontend/`
- API: Cloudflare Worker in `backend/src/`
- Database: Cloudflare D1 with schema migrations in `backend/migrations/`
- Data collection: local Python tooling in `data_collection/`
- Repository: GitHub monorepo

## Current database/auth direction

- `studyplanner-db` is the correctly named D1 target database.
- The legacy typo-named `studyplaner-db-test` is only a data/schema source and backup template.
- User-owned data is reduced to exactly three tables: `user_auth`, `user_state`, and `user_progress`.
- Server-side sessions are removed. Auth uses stateless signed bearer tokens with the Worker secret `AUTH_TOKEN_SECRET`.
- Logout deletes the client-side token only; immediate server-side token revocation is intentionally not available without reintroducing session/revocation state.

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

For local auth testing, configure `AUTH_TOKEN_SECRET` through Wrangler or an ignored local `.dev.vars` file.

### D1 migrations

```bash
cd backend
npx wrangler d1 migrations apply studyplanner-db --local
```

### Export the local SQLite data for D1

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Then import the generated file with Wrangler:

```bash
cd backend
npx wrangler d1 execute studyplanner-db --local --file .tmp/d1-seed.sql
```

## Remote safety checklist

Before any remote D1 rebuild or destructive migration:

1. Read current Cloudflare D1 state (`npx wrangler d1 list` and non-destructive count/schema queries).
2. Export/backup both `studyplaner-db-test` and `studyplanner-db` outside the repo.
3. Validate migrations and API flows locally.
4. Ask for explicit human approval before applying remote schema changes.

## Deployment

- Frontend: Cloudflare Pages from `frontend/`
- Backend: Cloudflare Worker from `backend/`
- Database: Cloudflare D1 bound as `DB`

Deploy command after the remote database plan is approved and secrets are configured:

```bash
npm run deploy:backend
```

## Environment variables

- Root examples: `.env.example`
- Frontend example: `frontend/.env.example`
- Worker variables: `backend/wrangler.toml`
- Worker secret: `AUTH_TOKEN_SECRET` (set with `npx wrangler secret put AUTH_TOKEN_SECRET`; never commit it)

## Further documentation

- Backend details: `backend/README.md`
- Authentication: `docs/authentication.md`
- Cloudflare development: `docs/cloudflare-development.md`
- Cloudflare setup: `docs/cloudflare-setup.md`
- Mock-data status: `docs/mock-data-status.md`
- Repo audit: `docs/repo-audit.md`

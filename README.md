# StudyPlanner

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

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
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

### Backend Worker

```bash
cd backend
npx wrangler dev
```

For local auth testing, configure `AUTH_TOKEN_SECRET` through Wrangler or an ignored local `.dev.vars` file.

### D1 migrations

```bash
npm run db:verify-config
npm run db:migrate:local
```

### Export the local SQLite data for D1

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
- Worker variables: `backend/wrangler.toml`
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

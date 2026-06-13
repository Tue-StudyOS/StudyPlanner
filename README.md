# StudyPlanner

Course planning app for Computer Science students at the University of Tübingen.

- Web app: <https://studyplaner.pages.dev>
- API Worker: <https://studyplanner-api.ben-tischberger.workers.dev>
- Public AI/OpenAPI metadata: <https://studyplanner-api.ben-tischberger.workers.dev/api/ai/meta>

## Development

- Frontend: React 19, Vite, Tailwind CSS 4
- Backend: Python Cloudflare Worker
- Database: Cloudflare D1 / SQLite migrations
- Catalog imports: local Python tooling for ALMA data

## Checks before committing

```powershell
npm run test:frontend
cd frontend
npm run lint
npm run build
```

When changing transcript parsing, also run:

```powershell
cd frontend
npm run validate:transcripts
```

## Runtime guardrails

- Active D1 binding: `DB`
- Active D1 database: `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`)
- Previous test DB: `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`)

Do not change the active database binding without explicit approval. Never commit `AUTH_TOKEN_SECRET` or generated secrets.

Useful docs:

- `docs/cloudflare-runtime-config.md`
- `docs/cloudflare-development.md`
- `docs/authentication.md`
- `docs/mobile-testing.md`
- `backend/README.md`

## Quick local commands

Local development:

```powershell
# terminal 1: frontend dev server (http://localhost:5173)
cd .\frontend\
npm run dev

# terminal 2: local backend Worker (http://localhost:8787)
cd .\backend\
npx wrangler dev
```

Local DB refresh:

```powershell
npm run db:verify-config
npm run db:migrate:local
python backend\scripts\export_sqlite_to_d1.py --data-out backend\.tmp\d1-seed.sql
cd backend
npx wrangler d1 execute DB --local --file .tmp\d1-seed.sql
```

Frontend checks:

```powershell
npm run test:frontend
cd frontend
npm run lint
npm run build
```

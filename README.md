# StudyPlanner

Study planning app for computer-science programs at the University of Tübingen.
Students browse the course catalog, plan semesters in a weekly schedule, import
their Transcript of Records (PDF), and track ECTS/grade progress against their
examination regulations (PO).

- Deployed app: <https://studyplaner.pages.dev>
- API Worker: <https://studyplanner-api.ben-tischberger.workers.dev>

## Tech stack

- **Frontend** (`frontend/`): React 19 + Vite + Tailwind CSS 4, deployed to Cloudflare Pages
- **API** (`backend/`): Python Worker on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite), schema in `backend/migrations/`
- **Data collection** (`data_collection/`): local Python tooling for the ALMA course catalog

## Database and bindings

The Worker binds D1 as `DB` (see `backend/wrangler.toml`):

- Active runtime DB: `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`)
- Previous test DB: `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`) — do not switch back without explicit approval

The DB name/UUID are public binding config. The only secret is the Worker
secret `AUTH_TOKEN_SECRET` (stateless signed bearer tokens; never commit it).
Run `npm run db:verify-config` before deploys or after touching Cloudflare config.

Eight clearly-marked demo courses (`INFO000N-TEST`, with weekly planner slots)
live in the catalog for testing category combinations and the schedule grid.
`backend/scripts/seed_test_courses.sql` (re)creates them idempotently; its
header documents the one-statement cleanup. Validate changes to it with
`python backend/scripts/check_seed_test_courses.py`.

## Local development

Most frontend work only needs the deployed API:

```bash
# frontend/.env.local (gitignored)
VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev
```

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

For a fully local stack (own users, own D1 state), see
`docs/cloudflare-development.md`. In short: prepare the local D1
(`npm run db:migrate:local`, seed via `db:export:d1`), put `AUTH_TOKEN_SECRET`
into `backend/.dev.vars`, then run `npx wrangler dev --persist-to .wrangler/state`
in `backend/`. Without `VITE_API_BASE_URL`, the frontend falls back to
`http://localhost:8787` on localhost.

## Scripts

From the repo root:

| Script | Purpose |
| --- | --- |
| `npm run dev:frontend` / `dev:backend` | Start frontend / local Worker |
| `npm run test:frontend` | Frontend unit tests (Node test runner) |
| `npm run build:frontend` | Typecheck + production build |
| `npm run db:verify-config` | Verify Cloudflare/D1 binding config |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run deploy:backend` | Deploy the Worker (runs config check first) |

Inside `frontend/` additionally: `npm run lint`, and
`npm run validate:transcripts` (parses the four reference ToR PDFs, see below).

## Tests and checks

Run before committing frontend changes:

```bash
npm run test:frontend          # unit + integration tests
cd frontend && npm run lint && npm run build
```

Manual mobile checks are documented in `docs/mobile-testing.md`.

## Transcript of Records import

The ToR PDF parser lives in `frontend/src/features/transcript/utils/` and runs
fully in the browser (pdf.js). It detects table columns from the per-page
header row, supports German and English exports (Bachelor and Master layouts),
and feeds the import review UI. Four real reference PDFs (2 German, 2 English)
can be placed untracked at the repo root for `npm run validate:transcripts`
and the integration tests; they contain personal data and must not be committed.

iOS note: `ensureReadableStreamAsyncIterator.ts` polyfills async iteration over
`ReadableStream` for Safari/iOS — pdf.js fails there without it.

## Project structure

```
frontend/src/features/   feature modules (courses, planner, transcript, dashboard, auth, ...)
frontend/src/shared/     shared components, hooks, utils
frontend/tests/          Node test runner suites
backend/src/             Worker entry, router, services, D1 access
backend/migrations/      D1 schema migrations
docs/                    architecture, Cloudflare, and testing docs
```

## Deployment

- Frontend: Cloudflare Pages project `studyplaner` (build from `frontend/`)
- Backend: `npm run db:verify-config && npm run deploy:backend`
- Remote D1 changes require the safety checklist in `docs/cloudflare-runtime-config.md`
  and explicit human approval

## Further documentation

- `docs/authentication.md` — auth model
- `docs/cloudflare-runtime-config.md` — runtime config reference
- `docs/cloudflare-development.md` — local Cloudflare development
- `docs/mobile-testing.md` — manual mobile test checklist
- `backend/README.md` — backend details

# StudyPlanner

StudyPlanner helps computer-science students at the University of Tübingen browse the course catalog, plan semester schedules, import Transcript of Records PDFs, and track ECTS/grade progress against their PO.

- Web app: <https://studyplaner.pages.dev>
- API Worker: <https://studyplanner-api.ben-tischberger.workers.dev>
- Public AI/OpenAPI metadata: <https://studyplanner-api.ben-tischberger.workers.dev/api/ai/meta>

## Use StudyPlanner in the browser

1. Open <https://studyplaner.pages.dev>.
2. Browse the public catalog without an account.
3. Create an account or sign in for personal features:
   - save interested courses,
   - build a weekly semester plan,
   - import your Transcript of Records PDF,
   - track completed courses, ECTS, grades, and PO areas.
4. Use the onboarding button in the top bar after login to replay the guided tour.

Personal planner, transcript, and progress data are account-bound and are only available after login.

## Use StudyPlanner from agents and AI tools

The current agent-facing surface is public and read-only. It exposes catalog search and course details only; it cannot access personal plans, transcripts, account data, or write anything.

### ChatGPT Actions / Custom GPTs

Use the OpenAPI schema from the deployed API Worker:

```text
https://studyplanner-api.ben-tischberger.workers.dev/api/ai/openapi.json
```

In a Custom GPT: Configure → Actions → Import from URL → paste the schema URL. Authentication is **None** for the current public catalog tools.

Available operations:

- `searchCourses` — search the public catalog with text and filters.
- `resolveCourse` — resolve a stable course number/title hint to the current course id.
- `getCourseDetail` — fetch compact public details for one course.

Example agent instruction:

```text
You help University of Tübingen Informatik students find courses. Use searchCourses for candidate lists and getCourseDetail before making claims about a specific course. Always cite course number and title.
```

### Claude, Cursor, and other MCP-capable agents

The hosted MCP adapter lives in `integrations/studyplanner-mcp/` and exposes the same public catalog facade.

Use the deployed MCP endpoint when available:

```text
https://studyplanner-mcp.ben-tischberger.workers.dev/mcp
```

For clients that still expect SSE discovery:

```text
https://studyplanner-mcp.ben-tischberger.workers.dev/sse
```

MCP tools:

- `studyplanner_search_courses`
- `studyplanner_resolve_course`
- `studyplanner_get_course_detail`

Do not paste StudyPlanner passwords, browser session tokens, OpenAI keys, or Anthropic keys into MCP configuration. Private/personal agent tools require a future integration-token or OAuth flow and are intentionally not enabled yet.

### Direct HTTPS calls

```bash
curl https://studyplanner-api.ben-tischberger.workers.dev/api/ai/meta

curl -X POST https://studyplanner-api.ben-tischberger.workers.dev/api/ai/catalog/search \
  -H "Content-Type: application/json" \
  -d '{"query":"machine learning","limit":3,"ects":{"min":6},"termTypes":["summer"]}'
```

## Tech stack

- **Frontend** (`frontend/`): React 19 + Vite + Tailwind CSS 4, deployed to Cloudflare Pages.
- **API** (`backend/`): Python Worker on Cloudflare Workers.
- **Database**: Cloudflare D1 (SQLite), schema in `backend/migrations/`.
- **AI/MCP integration** (`integrations/studyplanner-mcp/`): TypeScript Cloudflare Worker adapter for public catalog tools.
- **Data collection** (`data_collection/`): local Python tooling for ALMA catalog imports.

## Local development

Most frontend work can use the deployed API:

```bash
# frontend/.env.local (gitignored)
VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev
```

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

For a fully local stack with local users and local D1 state, see `docs/cloudflare-development.md`. Without `VITE_API_BASE_URL`, the frontend falls back to `http://localhost:8787` on localhost.

## Scripts

From the repo root:

| Script | Purpose |
| --- | --- |
| `npm run dev:frontend` / `dev:backend` | Start frontend / local Worker |
| `npm run test:frontend` | Frontend unit and integration tests |
| `npm run build:frontend` | Frontend typecheck + production build |
| `npm run test:mcp` / `build:mcp` | MCP adapter tests / build |
| `npm run db:verify-config` | Verify Cloudflare/D1 binding config |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run deploy:backend` | Deploy the API Worker (runs config check first) |

Inside `frontend/` additionally run `npm run lint` and `npm run validate:transcripts` when touching frontend or transcript-import code.

## Tests and checks

Run before committing frontend changes:

```bash
npm run test:frontend
cd frontend && npm run lint && npm run build
```

Manual mobile checks are documented in `docs/mobile-testing.md`.

## Database and Cloudflare guardrails

The Worker binds D1 as `DB` (see `backend/wrangler.toml`):

- Active runtime DB: `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`)
- Previous test DB: `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`) — do not switch back without explicit approval

The DB name/UUID are public binding config. The Worker secret `AUTH_TOKEN_SECRET` must never be committed. Run `npm run db:verify-config` before deploys or after touching Cloudflare config.

## Transcript of Records import

The ToR parser runs fully in the browser with pdf.js. It supports German and English ALMA exports, detects table columns per page, and feeds the import review UI. Reference PDFs used for validation contain personal data and must stay untracked.

iOS note: `ensureReadableStreamAsyncIterator.ts` polyfills async iteration over `ReadableStream` for Safari/iOS so pdf.js can read files there.

## Project structure

```text
frontend/src/features/        feature modules (courses, planner, transcript, dashboard, auth, ...)
frontend/src/shared/          shared components, hooks, utils
frontend/tests/               Node test runner suites
backend/src/                  Worker entry, router, services, D1 access
backend/migrations/           D1 schema migrations
integrations/studyplanner-mcp/ hosted MCP adapter
docs/                         architecture, Cloudflare, AI integration, and testing docs
```

## Deployment

- Frontend: Cloudflare Pages project `studyplaner` (builds from `frontend/`).
- Backend: `npm run db:verify-config && npm run deploy:backend`.
- MCP adapter: `npm run test:mcp && npm run build:mcp`, then `cd integrations/studyplanner-mcp && npx wrangler deploy`.
- Remote D1 changes require the safety checklist in `docs/cloudflare-runtime-config.md` and explicit human approval.

## Further documentation

- `docs/authentication.md` — auth model
- `docs/cloudflare-runtime-config.md` — runtime config reference
- `docs/cloudflare-development.md` — local Cloudflare development
- `docs/ai-integrations-setup.md` — ChatGPT Actions and MCP setup
- `docs/mobile-testing.md` — manual mobile test checklist
- `backend/README.md` — backend details

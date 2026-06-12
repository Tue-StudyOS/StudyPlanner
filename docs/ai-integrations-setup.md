# AI Integrations — Setup and Manual Cloudflare Steps

Status: **Phase 1 implemented** (public catalog AI facade, see
`docs/ai-integrations-mcp-openapi-plan.md`). Personal/authenticated tools
(Phases 2–4), the hosted MCP worker (Phase 6), and OAuth (Phase 7) are not
built yet.

## What exists in the code now

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ai/meta` | GET | Integration metadata + OpenAPI link |
| `/api/ai/openapi.json` | GET | OpenAPI 3.1 schema for ChatGPT Actions |
| `/api/ai/catalog/search` | POST | Compact course search (`query`, `limit` ≤ 25, `periodId` or `all`) |
| `/api/ai/catalog/courses/<id>` | GET | Compact course detail incl. description and exams |

All routes are public and read-only; no personal data is reachable.

## Manual steps you have to do (in order)

### 1. Deploy the worker

The AI routes live in the existing Python worker, so a normal deploy ships them:

```bash
npm run db:verify-config      # guardrail, runs automatically on predeploy too
npm run deploy:backend        # wrangler deploy of backend/
```

Also still pending from earlier work (safe, additive):

```bash
npm run db:migrate:remote     # applies 0021 (course links), 0022 (drop test courses)
```

### 2. Verify the deployment

```bash
curl https://studyplanner-api.<your-account>.workers.dev/api/ai/meta
curl -X POST https://studyplanner-api.<your-account>.workers.dev/api/ai/catalog/search \
  -H "Content-Type: application/json" -d '{"query":"machine learning","limit":3}'
```

Both must return JSON; the search must list courses.

### 3. Cloudflare dashboard — nothing to change for Phase 1

No new bindings, secrets, or routes are required: the AI facade reuses the
existing `DB` D1 binding. Check only that the worker URL is publicly reachable
(Workers → studyplanner-api → Triggers). If you front the worker with a custom
domain later, use that domain in step 4.

### 4. Create the Custom GPT (ChatGPT)

1. ChatGPT → Explore GPTs → **Create**.
2. Configure → **Actions** → *Import from URL* →
   `https://<worker-domain>/api/ai/openapi.json`.
3. Authentication: **None** (Phase 1 is public).
4. Instructions suggestion:
   > You help Informatik students at the University of Tübingen find courses.
   > Use searchCourses for queries and getCourseDetail before making claims
   > about a specific course. Always cite course number and title.
5. Test prompts: "Welche Machine-Learning-Vorlesungen gibt es?", then a detail
   question about one result.

### 5. Claude / MCP (until Phase 6 ships)

A hosted MCP worker does not exist yet. Until then Claude Code can use the API
directly (WebFetch/Bash against the endpoints above), or you wire a generic
OpenAPI-to-MCP bridge against `/api/ai/openapi.json`. The planned native
adapter goes into `integrations/studyplanner-mcp/` per the plan document.

## What unlocks the next phases

- **Phase 2 (tokens):** migration `user_integration_tokens` + Account UI; after
  that you must set no Cloudflare config — tokens live in D1.
- **Phase 6 (MCP worker):** new worker project → `wrangler deploy` from
  `integrations/studyplanner-mcp/`; it needs one Cloudflare secret holding
  nothing (stateless) and the AI facade URL as a plain var.

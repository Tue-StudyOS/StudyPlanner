# AI Integrations — Setup and Manual Cloudflare Steps

Status: **Phase 1 implemented** (public catalog AI facade for ChatGPT Actions)
and **public MCP adapter implemented** (hosted Worker for Claude/MCP-capable
agents). Personal/authenticated tools (Phases 2–4), writes, user grants, and
OAuth (Phase 7) are intentionally not built yet.

## What exists in the code now

### Existing StudyPlanner AI facade

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ai/meta` | GET | Integration metadata + OpenAPI link |
| `/api/ai/openapi.json` | GET | OpenAPI 3.1 schema for ChatGPT Actions |
| `/api/ai/catalog/search` | POST | Compact course search (`query`, `limit` ≤ 25, `periodId` or `all`) |
| `/api/ai/catalog/courses/<id>` | GET | Compact course detail incl. description and exams |

### Hosted MCP adapter

Location: `integrations/studyplanner-mcp/`

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Worker smoke check |
| `/mcp` | POST | Streamable HTTP JSON-RPC MCP endpoint |
| `/messages` | POST | Compatibility alias for `/mcp` |
| `/sse` | GET | Lightweight SSE endpoint advertisement for older clients |

Tools exposed by the MCP adapter:

| Tool | Purpose |
| --- | --- |
| `studyplanner_search_courses` | Calls `/api/ai/catalog/search` |
| `studyplanner_get_course_detail` | Calls `/api/ai/catalog/courses/<id>` |

All AI facade routes and MCP tools are public and read-only; no personal data is reachable.

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

### 5. Deploy the hosted MCP worker

The first MCP worker is stateless and calls the existing StudyPlanner AI facade
over HTTPS. It does not need D1, OpenAI, or Anthropic secrets.

```bash
npm run test:mcp
npm run build:mcp
npm run db:verify-config
cd integrations/studyplanner-mcp
npx wrangler deploy
```

Cloudflare domain choice:

- If an existing StudyPlanner domain/subdomain is already managed in
  Cloudflare, add a Worker route for the MCP Worker there.
- Otherwise use the default `*.workers.dev` URL. Do not buy a new domain for
  this first public-catalog-only version.

If the StudyPlanner API is available under a custom domain, set the MCP
Worker variable `STUDYPLANNER_AI_BASE_URL` to that API origin. Otherwise keep
the default Workers URL in `integrations/studyplanner-mcp/wrangler.toml`.

### 6. Connect Claude / MCP-capable clients

Use the deployed MCP Worker URL, normally:

```text
https://<mcp-worker-domain>/mcp
```

For clients that still expect the older SSE discovery URL, try:

```text
https://<mcp-worker-domain>/sse
```

The first version exposes only public course search/detail tools. Do not paste
StudyPlanner passwords, browser session tokens, OpenAI keys, or Anthropic keys
into the MCP Worker config.

## What unlocks the next phases

- **Phase 2 (tokens):** migration `user_integration_tokens` + Account UI; after
  that you must set no Cloudflare config — tokens live in D1.
- **Private MCP/GPT tools:** add scoped integration tokens or OAuth first;
  then extend the AI facade and MCP adapter with read-only personal tools.

# AI Integrations — GPT and Claude Setup

Status: **public catalog integration implemented** for ChatGPT/OpenAPI and hosted MCP. Personal/authenticated tools, writes, user grants, and OAuth are intentionally not built yet.

Public gateway:

```text
https://studyplaner.pages.dev
```

Public endpoints:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ai/meta` | GET | Integration metadata + OpenAPI link |
| `/api/ai/openapi.json` | GET | OpenAPI 3.1 schema for ChatGPT Actions |
| `/api/ai/catalog/search` | POST | Compact course search with structured filters |
| `/api/ai/catalog/resolve-course` | POST | Resolve a stable `courseNumber` to the current numeric course id |
| `/api/ai/catalog/courses/<id>` | GET | Compact public course detail |
| `/mcp` | POST | Streamable HTTP JSON-RPC MCP endpoint |
| `/messages` | POST | Compatibility alias for `/mcp` |
| `/sse` | GET | Lightweight SSE endpoint advertisement for older MCP clients |
| `/privacy` | GET | Public privacy policy |

All routes above are public and read-only. They do not expose accounts, profiles, progress, semester plans, transcripts, passwords, browser tokens, OpenAI keys, or Anthropic keys.

## ChatGPT Custom GPT setup

1. ChatGPT → **Explore GPTs** → **Create**.
2. Configure → **Actions** → **Import from URL**.
3. Import this OpenAPI URL:

   ```text
   https://studyplaner.pages.dev/api/ai/openapi.json
   ```

4. Authentication: **None**.
5. Privacy policy URL:

   ```text
   https://studyplaner.pages.dev/privacy
   ```

6. Suggested instructions:

   ```text
   You help Informatik students at the University of Tübingen find courses in the StudyPlanner catalog. Use searchCourses for course searches, resolveCourse when the user gives a course number, and getCourseDetail before making claims about a specific course. Always mention the course number and title when available. The integration is read-only and has no access to personal StudyPlanner data.
   ```

7. Test prompts:
   - `Welche Machine-Learning-Kurse gibt es?`
   - `Zeig mir Details zum passendsten Kurs.`
   - `Suche Seminare mit 6 ECTS im Sommer.`

## Claude / MCP setup

Use the hosted MCP endpoint:

```text
https://studyplaner.pages.dev/mcp
```

For Claude or another MCP client with direct remote MCP support:

1. Add a custom MCP connector/server.
2. Name: `StudyPlanner`.
3. URL: `https://studyplaner.pages.dev/mcp`.
4. Authentication: **None**.
5. Test with: `Nutze StudyPlanner und suche Kurse zu Machine Learning.`

For Claude Desktop clients that need a local bridge, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "studyplanner": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://studyplaner.pages.dev/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop after saving the file.

Older clients that ask for an SSE discovery URL can try:

```text
https://studyplaner.pages.dev/sse
```

## Local smoke test

Run the three public pieces locally:

```bash
# terminal 1: backend AI facade at http://localhost:8787
cd backend
npx wrangler dev

# terminal 2: MCP worker at http://localhost:8788
cd integrations/studyplanner-mcp
npx wrangler dev --port 8788

# terminal 3: Pages gateway at http://localhost:8789
cd frontend
npm run build
npx wrangler pages dev dist --port 8789
```

Then verify:

```bash
curl http://localhost:8789/api/ai/meta
curl http://localhost:8789/privacy
curl -X POST http://localhost:8789/api/ai/catalog/search \
  -H "Content-Type: application/json" \
  -d '{"query":"machine learning","limit":3,"ects":{"min":6},"termTypes":["summer"]}'
curl -X POST http://localhost:8789/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Deploy order

1. Verify config:

   ```bash
   npm run db:verify-config
   ```

2. Deploy the backend AI facade:

   ```bash
   npm run deploy:backend
   ```

3. Deploy the MCP Worker:

   ```bash
   npm run test:mcp
   npm run build:mcp
   cd integrations/studyplanner-mcp
   npx wrangler deploy
   ```

4. Deploy the Pages gateway/frontend:

   ```bash
   cd frontend
   npm run build
   npx wrangler pages deploy dist --project-name studyplaner
   ```

5. Production smoke tests:

   ```bash
   curl https://studyplaner.pages.dev/api/ai/meta
   curl https://studyplaner.pages.dev/privacy
   curl -X POST https://studyplaner.pages.dev/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

## What unlocks the next phases

- **Scoped integration tokens:** required before private profile/progress/plan tools.
- **OAuth:** required before a shared multi-user GPT can safely access personal StudyPlanner data.
- **Write tools:** require backend dry-run, explicit `confirmApply: true`, scope checks, validation, and revocation before public release.

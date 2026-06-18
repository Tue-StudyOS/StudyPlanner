# StudyPlanner

Course planning app for Computer Science students at the University of Tübingen.

- Web app and public AI gateway: <https://studyplaner.pages.dev>
- Public AI/OpenAPI metadata: <https://studyplaner.pages.dev/api/ai/meta>
- Public MCP endpoint: <https://studyplaner.pages.dev/mcp>
- Privacy policy: <https://studyplaner.pages.dev/privacy>

## AI integrations

The public AI integration is read-only and unauthenticated. It exposes course catalog search, course-reference resolution, and course detail lookup only. It does not expose StudyPlanner accounts, profiles, progress, semester plans, transcript data, passwords, browser tokens, OpenAI keys, or Anthropic keys.

### ChatGPT Custom GPT setup

1. Open ChatGPT → **Explore GPTs** → **Create**.
2. Configure → **Actions** → **Import from URL**.
3. Use this OpenAPI URL:

   ```text
   https://studyplaner.pages.dev/api/ai/openapi.json
   ```

4. Authentication: **None**.
5. Privacy policy URL:

   ```text
   https://studyplaner.pages.dev/privacy
   ```

6. Suggested GPT instructions:

   ```text
   You help Informatik students at the University of Tübingen find courses in the StudyPlanner catalog. Use searchCourses for course searches, resolveCourse when the user gives a course number, and getCourseDetail before making claims about a specific course. Always mention the course number and title when available. The integration is read-only and has no access to personal StudyPlanner data.
   ```

7. Test prompts:
   - `Welche Machine-Learning-Kurse gibt es?`
   - `Zeig mir Details zum passendsten Kurs.`
   - `Suche Seminare mit 6 ECTS im Sommer.`

### Claude / MCP setup

Use the public MCP endpoint:

```text
https://studyplaner.pages.dev/mcp
```

If your Claude or MCP client supports remote MCP/connectors directly:

1. Add a custom MCP connector/server.
2. Name: `StudyPlanner`.
3. URL: `https://studyplaner.pages.dev/mcp`.
4. Authentication: **None**.
5. Test with: `Nutze StudyPlanner und suche Kurse zu Machine Learning.`

For Claude Desktop clients that still need a local bridge, add this to `claude_desktop_config.json`:

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

Then restart Claude Desktop. Older clients that ask for an SSE discovery URL can try:

```text
https://studyplaner.pages.dev/sse
```

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

- `docs/ai-integrations-setup.md`
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

Local public AI gateway smoke test:

```powershell
# terminal 1: local backend Worker (http://localhost:8787)
cd .\backend\
npx wrangler dev

# terminal 2: local MCP Worker (http://localhost:8788)
cd .\integrations\studyplanner-mcp\
npx wrangler dev --port 8788

# terminal 3: local Pages gateway (http://localhost:8789)
cd .\frontend\
npm run build
npx wrangler pages dev dist --port 8789
```

Then check:

```powershell
curl http://localhost:8789/api/ai/meta
curl http://localhost:8789/privacy
curl -X POST http://localhost:8789/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
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

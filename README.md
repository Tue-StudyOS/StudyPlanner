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

Use the exact `/mcp` URL. If Claude shows `Dieser Konnektor hat keine Tools verfügbar`, remove the connector and add it again after deployment; Claude can cache failed discovery attempts.

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
- `docs/repository-overhaul-2026-07.md`
- `docs/code-simplification-audit-2026-07.md`
- `backend/README.md`

## Simulated semester (live onboarding testing)

To test the new-user onboarding flow as if users were planning an upcoming winter
semester, the live app can pretend the current semester is `SS 2025`. The upcoming
winter is then `WS 2025/26` — the newest winter catalog we have — so its courses
show up as confirmed offerings without importing data or changing any tags.

The toggle is a row in the `app_settings` D1 table, served at `GET /api/config` and
applied by the frontend at boot. Flipping it takes effect live, **without a
redeploy** (only the one-time deploy that shipped the endpoint + migration `0025`):

```powershell
npm run sim:on      # switch the live app to SS 2025 (plan the upcoming WS 2025/26)
npm run sim:status  # show the current setting
npm run sim:off     # switch back to the real, date-derived semester
```

`sim:on` / `sim:off` write to the production D1, so the change is visible to all
visitors; returning users may need one page reload. To simulate a different
semester, edit the label in the `sim:on` script (any `SS <year>` or `WS <year>/<yy>`).
Details: `docs/cloudflare-runtime-config.md`.

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

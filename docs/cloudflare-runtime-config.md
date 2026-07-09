# Cloudflare runtime configuration

This is the canonical repo-side reference for the Cloudflare Workers, Pages public gateway, and D1 database names.

## Current active resources

| Purpose | Name | ID / URL | Notes |
| --- | --- | --- | --- |
| Active D1 runtime database | `studyplanner-db` | `80ca9092-ddc6-454a-b04a-8ccae85ef2f5` | Production database since the approved `integrate_new_db` cutover (multi-period ALMA catalog). |
| Previous test D1 | `studyplaner-db-test` | `297f7a28-9069-431d-b989-49acf2537513` | Superseded by the cutover; delete after the new database is verified. |
| API Worker | `studyplanner-api` | `https://studyplanner-api.ben-tischberger.workers.dev` | Source of truth for app and public AI facade API routes. |
| MCP Worker | `studyplanner-mcp` | internal Worker service binding | Hosted MCP adapter for Claude/MCP-capable clients. |
| Pages project / public gateway | `studyplaner` | `https://studyplaner.pages.dev` | Public frontend, OpenAPI, privacy, and MCP gateway. |

The Worker D1 binding name is always `DB`. Helper commands intentionally use `DB` so migrations follow the checked `backend/wrangler.toml` binding instead of duplicating a database name in multiple scripts.

The deployed browser app calls the API Worker origin directly through `VITE_API_BASE_URL`. Pages Functions service bindings remain configured for manual gateway testing and non-browser endpoints, but the app does not depend on `/api/*` on the Pages host because Worker-to-Python-Worker proxy calls can be canceled by the Cloudflare runtime.

Pages Functions forward:

- `/api/*` → `STUDYPLANNER_API` service binding
- `/mcp`, `/messages`, `/sse`, `/privacy`, `/app/catalog-results.html` → `STUDYPLANNER_MCP` service binding

## Secret handling

- D1 database names and UUIDs are public Cloudflare binding config. They are safe to keep in `wrangler.toml`, examples, and docs.
- `AUTH_TOKEN_SECRET` is a real secret. Never commit it.
- Configure it per Worker script:

```bash
cd backend
npx wrangler secret put AUTH_TOKEN_SECRET --name studyplanner-api
```

If the legacy typo Worker is still reachable from any deployed frontend build, configure it there too:

```bash
cd backend
npx wrangler secret put AUTH_TOKEN_SECRET --name studyplaner-api
```

## Guardrails against accidental DB switches

Run this before deploys and after any Cloudflare config change:

```bash
npm run db:verify-config
```

The verifier checks:

- `backend/wrangler.toml` keeps `DB` bound to `studyplanner-db`
- `frontend/wrangler.toml` points deployed browser builds at `https://studyplanner-api.ben-tischberger.workers.dev`
- `frontend/wrangler.toml` keeps the Pages gateway service bindings for API and MCP
- `.env.example` documents the active D1 name and id
- package scripts keep using the checked `DB` binding

The GitHub workflow `.github/workflows/verify-cloudflare-config.yml` runs the same check. To make it hard for future agents to change these values accidentally, require that workflow in GitHub branch protection for `main`.

## Deploy and smoke-test checklist

```bash
npm run db:verify-config
npm run deploy:backend
cd integrations/studyplanner-mcp
npx wrangler deploy
cd ../../frontend
npm run build
npx wrangler pages deploy dist --project-name studyplaner
```

Then verify:

```bash
curl https://studyplanner-api.ben-tischberger.workers.dev/api/ai/meta
curl https://studyplaner.pages.dev/privacy
curl https://studyplanner-api.ben-tischberger.workers.dev/api/auth/session \
  -H "Authorization: Bearer invalid-token"
curl -X POST https://studyplaner.pages.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected auth-session response for an invalid token is `{"authenticated": false, "user": null}`. If it returns `AUTH_TOKEN_SECRET must be configured as a Worker secret`, the Worker secret is missing on the API Worker.

## Simulated semester (live onboarding test)

To live-test the new-user onboarding flow as if users were planning an upcoming
winter semester, the app can pretend the current semester is `SS 2025`. The
upcoming winter is then `WS 2025/26`, which is the newest winter catalog we have,
so its courses show as confirmed offerings — no data import or tag changes needed.

The toggle is a row in the `app_settings` D1 table
(`simulated_current_semester_label`). The API Worker serves it at `GET /api/config`
and the frontend reads it at boot, overriding `getCurrentSemesterLabel`. Because
the Worker reads it live from D1, flipping it does **not** require a redeploy
(only the one-time deploy that ships the endpoint + migration `0025`).

```bash
npm run sim:on      # pretend it is SS 2025 (plan the upcoming WS 2025/26)
npm run sim:status  # show the current setting
npm run sim:off     # restore the real, date-derived semester
```

To simulate a different semester, edit the label in the `sim:on` script (any
`SS <year>` / `WS <year>/<yy>` value) or run the `wrangler d1 execute` command
directly. Returning users may need one page reload to pick up a change.

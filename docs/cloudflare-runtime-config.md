# Cloudflare runtime configuration

Canonical repository reference for the API Worker, Pages gateway and D1 bindings.
For commands, use [local development](cloudflare-development.md) or
[deployment](cloudflare-setup.md).

## Current resources

| Purpose | Name | ID / URL |
| --- | --- | --- |
| Active D1, binding DB | studyplanner-db | 80ca9092-ddc6-454a-b04a-8ccae85ef2f5 |
| Previous test D1, not the active binding | studyplaner-db-test | 297f7a28-9069-431d-b989-49acf2537513 |
| API Worker | studyplanner-api | https://studyplanner-api.ben-tischberger.workers.dev |
| MCP Worker | studyplanner-mcp | Reached through the Pages MCP service binding |
| Pages project | studyplaner | https://studyplaner.pages.dev |

The production database cutover was approved on integrate_new_db. Do not switch
the DB binding again, recreate either database, or treat the previous database as
a routine deletion target.

## Browser and gateway routing

The source of truth is frontend/src/shared/utils/apiBaseUrl.ts:

- A non-empty VITE_API_BASE_URL overrides API routing.
- Without an override, localhost/127.0.0.1 use http://localhost:8787.
- Without an override, deployed hosts use same-origin /api/*.

The checked Pages config includes a direct Worker URL as public build
configuration. An actual build's environment determines whether that override
is present; local Vite builds do not read Wrangler's [vars].

Pages Functions forward /api/* to the API and /mcp, /messages, /sse, /privacy and
/app/catalog-results.html to MCP. In frontend/functions/_shared/proxy.ts an
explicit STUDYPLANNER_API_ORIGIN or STUDYPLANNER_MCP_ORIGIN takes precedence over
a service binding. The checked production API origin is the public API Worker;
MCP uses its service binding. Local gateway fallback ports are 8787 and 8788.

## Runtime guardrails

- Keep backend/wrangler.toml at compatibility_date **2025-05-20** and entrypoint
  **on_fetch**. Raising the date requires a cold remote development check first;
  the previous attempted bump failed on every request. See the retained
  [load-test investigation](load-test-2026-08.md).
- Run `npm run db:verify-config` before deploys or after Cloudflare config changes.
  The [GitHub workflow](../.github/workflows/verify-cloudflare-config.yml) runs this
  check and should be required on main.
- D1 names and UUIDs are public config. AUTH_TOKEN_SECRET is a real secret.
  Use ignored backend/.dev.vars locally and a Worker secret in production.
- Authentication uses HttpOnly cookies and CSRF protection. See
  [authentication](authentication.md) for session invalidation and deletion behavior.
- Temporary diagnostics, feedback and stale rate-limit records are cleaned up
  during normal requests; no separate retention cron is required.

## Catalog refresh

Refresh the **existing production D1 in place** with reviewed ALMA output, after
the required approval/backup. From the repository root:

```powershell
python backend/scripts/import_alma_json_to_d1.py --input <courses_multi_semester.json> --apply --skip-create --skip-swap --skip-migrate
```

Replace the input placeholder with the actual JSON path. Keep **every period
that must survive** in the input: the importer deletes and replaces catalog rows.
Read the importer docstring for remote-import limits and retry behavior.

Numeric courses.id values are reassigned during reseeding. New user-generated
records must use the stable ALMA course number, falling back to unit_id, following
course_catalog.normalize_review_key(). Reviews and external links follow this
rule and must remain outside SEEDED_TABLES_DELETE_ORDER. Existing legacy
ID-based planner/favorite references require care when reseeding.

The tracked SQLite export is a local bootstrap source for catalog and curriculum
tooling. Export it with --skip-schema so an existing migration is not rewritten;
do not treat that dump as a current production backup.

## Simulated semester

The app_settings key simulated_current_semester_label is returned by GET
/api/config and read at frontend boot. The existing scripts target **production**:

```powershell
npm run sim:status
npm run sim:on
npm run sim:off
```

sim:on sets SS 2025, making WS 2025/26 the upcoming winter semester.
sim:off restores date-derived behavior. These settings affect all visitors after
reload, without redeployment. This historical semester is a test fixture, not a
claim about the latest available catalog.

# Local development

The normal app needs two processes: Vite on port 5173 and the Python Worker on
port 8787. Wrangler uses a local D1 database by default. Local accounts and data
are separate from production.

## Prerequisites

- Node.js **22.13+** in the 22.x line, or a newer supported LTS, with npm.
- Python **3.11+** for the config verifier and catalog export.
- Internet access on first use to download npm packages and Wrangler's runtime.

The frontend has a lockfile; install with `npm ci`. The backend has no npm
package or pip dependencies to install for normal Worker development. This repo
invokes Wrangler using `npx`; it does not pin a Wrangler dependency. Record
`npx wrangler --version` when reporting runtime failures.

## One-time setup

Start in the repository root:

```powershell
npm --prefix frontend ci
npm run db:verify-config
```

Create **`backend/.dev.vars`** with a unique local signing secret. This PowerShell
command creates the ignored file only if it does not already exist, without
printing the generated value:

```powershell
if (-not (Test-Path backend/.dev.vars)) {
    python -c "import pathlib, secrets; pathlib.Path('backend/.dev.vars').write_text('AUTH_TOKEN_SECRET=' + secrets.token_hex(32) + '\n', encoding='utf-8')"
}
```

Wrangler reads this file beside `backend/wrangler.toml`. A Cloudflare CLI login
does not configure the local signing secret. Do not copy a production secret here.

Prepare the local schema and export the catalog seed. **Current limitation:**
on 11–12 September 2026, the final import below failed with Wrangler 4.131.1
on Windows ("other side closed") for the roughly 63 MB tracked SQLite export.
Migrations and server startup passed, but a fresh, fully populated local catalog
is not yet verified. If you already have a working local catalog, keep it and
skip this bootstrap import. See the verification notes below.

```powershell
# Repository root
npm run db:migrate:local
python backend/scripts/export_sqlite_to_d1.py --skip-schema --data-out backend/.tmp/d1-seed.sql
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
cd ..
```

The seed uses tracked `backend/data/alma.sqlite` plus regulation JSON; it is a
local bootstrap snapshot, not a download of the current production catalog.
`--skip-schema` prevents the exporter from rewriting `0001_initial.sql`.
The dump deletes and replaces source tables. Use it for a fresh local database;
rerunning it can invalidate references and conflict with newer dependent data.
The full import may fail as described above; an empty catalog is not evidence
that the migration step failed.
Production catalog refresh uses the separate [runtime workflow](cloudflare-runtime-config.md#catalog-refresh).

## Daily startup

Open **two terminals, each at the repository root**.

```powershell
# Terminal 1: frontend
cd .\frontend\
npm run dev
```

```powershell
# Terminal 2: backend
cd .\backend\
npx wrangler dev
```

Open [localhost:5173/catalog](http://localhost:5173/catalog).
Stop each server with Ctrl+C. Alternatively, run `npm run dev:frontend` and
`npm run dev:backend` from the root in separate terminals.

No frontend env file is needed. If you already set `VITE_API_BASE_URL` in
`frontend/.env.local` or your shell, remove the override or set it to
`http://localhost:8787`, then restart Vite.

Wrangler persists local D1 under `backend/.wrangler/state`. If you use a custom
`--persist-to` path, use that same path for migrations, seed import and `dev`.

## Smoke checks

In a third PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:8787/health
Invoke-RestMethod 'http://localhost:8787/api/catalog/courses?limit=2'
Invoke-RestMethod http://localhost:8787/api/auth/session
```

Health should report D1 reachability, the catalog should contain courses after
seeding, and the session endpoint should report an unauthenticated user before
login. Register a disposable local account in the browser to test personal features.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Catalog request fails | Start the Worker and check health; check the frontend API override. |
| Missing table errors | Apply all local migrations using the same persistence directory as dev. |
| Empty catalog | Import the local seed; migrations alone do not load the ALMA snapshot. |
| Missing AUTH_TOKEN_SECRET | Create backend/.dev.vars, then restart Wrangler. |
| Vite chooses port 5174 | Port 5173 is busy. Stop the other server or add the chosen origin to local ALLOWED_ORIGINS; the default allows 5173. |
| CORS/login errors | Use localhost consistently. 127.0.0.1:5173 is not in the default origin allow-list. |
| Python Worker startup or dispatch errors | Record the Wrangler version and error. Keep the pinned compatibility date; see the runtime notes. |
| Production account missing locally | Local D1 has its own accounts. Create a local account. |

To deliberately test frontend changes against production, set
`VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev` in ignored
`frontend/.env.local` and restart Vite. Actions then affect real account data.
Cross-site cookie restrictions can affect this mode; use the full local setup
for isolated authentication testing.

## Verification record (11–12 September 2026)

Checked with Node 22.15.0, Python 3.12.1 and Wrangler 4.131.1 on Windows:

- Frontend dev server started and /catalog returned HTTP 200.
- All local migrations through 0037 applied in a separate temporary D1 state.
- The SQLite exporter completed with --skip-schema and left migrations unchanged.
- The single-file seed import failed with "other side closed"; populated-catalog
  and fresh local-account browser flows were not verified end to end.
- The Python Worker started against the migrated temporary state; /health reported
  D1 reachable and /api/auth/session returned an unauthenticated session.
- Frontend unit tests, lint, build and the Cloudflare config guard passed.

The verification used --persist-to .tmp/docs-local-state and backend port 8797
so it did not replace existing local data or stop existing development servers.
Normal daily commands use the default state and ports shown above. A future
import-tool change should address the large seed before marking fresh setup fully
verified; do not retry this bootstrap against production.

## Other workflows

- [Deploy to Cloudflare](cloudflare-setup.md)
- [Optional MCP/Pages gateway](ai-integrations-setup.md#local-smoke-test)
- [Frontend checks](../frontend/README.md#checks)
- [Scraper setup](../data_collection/QUICKSTART.md)

Reference: Cloudflare's [local development](https://developers.cloudflare.com/workers/local-development/)
and [local secrets](https://developers.cloudflare.com/workers/configuration/secrets/) documentation.

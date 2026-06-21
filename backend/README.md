# StudyPlanner API Backend

This folder contains the Cloudflare Worker API and D1 migration assets. See `../docs/cloudflare-runtime-config.md` for the canonical active Cloudflare resource names.

## Structure

```text
backend/
├── data/                    # local source data kept in git for migration work
├── migrations/              # D1 schema migrations
├── scripts/                 # local helper scripts, e.g. SQLite -> D1 export
├── src/                     # Cloudflare Worker source
├── pyproject.toml
└── wrangler.toml
```

## Worker routes

- `GET /` – service metadata and route overview
- `GET /health` – health check plus D1 reachability
- `GET /privacy` – privacy policy page for public AI integrations
- Public AI catalog facade:
  - `GET /api/ai/meta`
  - `GET /api/ai/openapi.json`
  - `POST /api/ai/catalog/search`
  - `POST /api/ai/catalog/resolve-course`
  - `GET /api/ai/catalog/courses/<id>`
- Public catalog and regulation data:
  - `GET /api/courses?limit=50`, `GET /api/courses/<id>`
  - `GET /api/catalog/periods`
  - `GET /api/catalog/courses?limit=100&period=<periodId|all>&q=<search>`
  - `GET /api/catalog/courses/<id>`
  - `GET /api/study-programs`
  - `GET /api/regulation-versions`, `GET /api/regulation-versions/<code>`
  - `GET /api/regulation-versions/<code>/courses?limit=100&q=<search>`
- Auth and user data:
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`
  - `GET/PATCH /api/me/profile`, `PATCH /api/me/credentials`
  - `GET/PUT /api/me/favorites`
  - `GET/PUT /api/me/completed-courses`, `POST /api/me/completed-courses/import`
  - `GET/PUT /api/me/transcript-issues`
  - `GET /api/me/semester-plans`, `GET/PUT/DELETE /api/me/semester-plans/<semester>`
  - `POST /api/me/semester-plans/<semester>/balance`
  - `GET /api/me/progress`
- `POST /api/feedback` – public user feedback submission

## D1 databases

- `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`) is the current active runtime database configured in `wrangler.toml` through the `DB` binding.
- `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`) is the previous test database from before the approved `integrate_new_db` cutover.
- Database names and UUIDs are public Cloudflare binding config; keep `AUTH_TOKEN_SECRET` as a Worker secret only.
- Do not switch the active D1 binding or run destructive remote D1 commands until a human explicitly confirms the change.

## User/auth schema

The user-owned schema is intentionally reduced to three tables:

1. `user_auth` — username, email, password hash/salt, auth timestamps
2. `user_state` — display/profile settings, favorites JSON, semester plans JSON
3. `user_progress` — completed courses JSON, transcript review items JSON

`user_sessions` is removed. Auth uses stateless HMAC-signed bearer tokens with `username`, `iat`, and `exp` claims. Configure the signing key as a Worker secret:

```bash
cd backend
npx wrangler secret put AUTH_TOKEN_SECRET --name studyplanner-api
```

Logout deletes the client-side token only. Trade-off: without server-side token state there is no immediate all-device revocation; tokens remain valid until `AUTH_TOKEN_TTL_SECONDS` expires.

## Local development

```bash
cd backend
npx wrangler dev
```

For local auth testing, provide `AUTH_TOKEN_SECRET` via an ignored local `.dev.vars` file or your Wrangler secret setup.

## D1 workflow

Apply schema migrations locally first through the checked `DB` binding from the repo root:

```bash
npm run db:verify-config
npm run db:migrate:local
```

Create a data-only SQL dump from the tracked SQLite database plus the official PO 2021 JSON seeds from `einzupflegene_po/`:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Import the generated dump into the local D1 database:

```bash
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
```

## Remote backup/export checklist

Before any remote rebuild or destructive migration:

1. Confirm the active Cloudflare account and list D1 databases with `npx wrangler d1 list`.
2. Export/backup the active `studyplanner-db`; also keep a backup of `studyplaner-db-test` if it is needed as a historical reference.
3. Store dumps outside the repo, not in `backend/.tmp/` if they contain private user data.
4. Verify local migration plus API behavior against the checked `DB` binding.
5. Ask for explicit approval before applying remote schema changes, deleting remote tables, or changing the active D1 binding.

Remote migration command from the repo root, after approval only:

```bash
npm run db:verify-config
npm run db:migrate:remote
```

## Notes

- The first D1 migration intentionally excludes the SQLite FTS tables.
- `backend/data/alma.sqlite` remains the local source for catalog/course data inside generated D1 imports.
- `backend/scripts/export_sqlite_to_d1.py` appends the supported PO 2021 study-program/regulation seed from `einzupflegene_po/`.

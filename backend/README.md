# StudyPlanner API Backend

This folder contains the Cloudflare Worker API and D1 migration assets. See [runtime configuration](../docs/cloudflare-runtime-config.md) for the canonical active Cloudflare resource names.

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
- Additional routes:
  - `GET /api/config`
  - `GET /api/catalog/courses/<id>/reviews`
  - `PUT/DELETE /api/me/course-reviews/<courseId>`
  - `DELETE /api/me/account`, `DELETE /api/me/transcript-data`
  - `GET/POST /api/client-errors` (read access is authenticated and scoped)
- `POST /api/feedback` – public user feedback submission

## D1 databases

- `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`) is the current active runtime database configured in `wrangler.toml` through the `DB` binding.
- `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`) is the previous test database; do not switch the active runtime DB again without explicit human approval.
- Database names and UUIDs are public Cloudflare binding config; keep `AUTH_TOKEN_SECRET` as a Worker secret only.
- Do not switch the active D1 binding or run destructive remote D1 commands until a human explicitly confirms the change.

## User/auth schema

The core account state uses three tables:

1. `user_auth` — username, email, password hash/salt, auth timestamps
2. `user_state` — display/profile settings, favorites JSON, semester plans JSON
3. `user_progress` — completed courses JSON, transcript review items JSON

Additional user-owned data includes course reviews and external links; these
use stable ALMA course keys and must survive catalog reseeds.

There is no user_sessions table. Sessions are HMAC-signed tokens in HttpOnly
cookies, with CSRF protection for authenticated mutations. Changing credentials
increments the account session version and invalidates old sessions. Logout
expires the browser cookie and clears private browser caches. See
[authentication](../docs/authentication.md) for the full contract.

## Local development

Complete the [one-time local setup](../docs/cloudflare-development.md#one-time-setup)
for dependencies, backend/.dev.vars, local migrations and catalog seeding.
Then run from the repository root:

```powershell
cd backend
npx wrangler dev
```

The Worker listens on http://localhost:8787. No FastAPI/Uvicorn server or pip
installation is needed; Wrangler runs the Python Worker runtime.

## D1 workflow

Use the [local setup](../docs/cloudflare-development.md) for a fresh local DB.
The SQLite exporter needs --skip-schema when producing a seed so it does not
rewrite an existing migration. Use the [in-place catalog refresh](../docs/cloudflare-runtime-config.md#catalog-refresh)
for production ALMA updates. The local bootstrap snapshot is not a production backup.

## Moodle learning-platform links

The public Moodle Informatik category is supplemental data for Moodle links and
course summaries. It does not expose reliable numeric participant limits, even
when inspecting public enrolment pages; structured participant limits continue
to come from ALMA `parallel_groups`.

Scrape and match Moodle from the repo root:

```bash
python -m data_collection.moodle.cli \
  --category-url "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235" \
  --match-sqlite backend/data/alma.sqlite \
  --out data_collection/output/moodle_courses.json \
  --matches-out data_collection/output/moodle_matches.json
```

If unresolved matches remain, run the manual review helper, save overrides in
the browser, stop the server, and apply the saved overrides:

```bash
python -m data_collection.moodle.review serve \
  --matches data_collection/output/moodle_matches.json \
  --alma-db backend/data/alma.sqlite \
  --out data_collection/output/moodle_manual_overrides.json \
  --open
python -m data_collection.moodle.review apply \
  --matches data_collection/output/moodle_matches.json \
  --overrides data_collection/output/moodle_manual_overrides.json \
  --out data_collection/output/moodle_matches.json
```

Generate and apply the Moodle seed after schema migrations:

```bash
python backend/scripts/import_moodle_json_to_d1.py \
  --input data_collection/output/moodle_matches.json \
  --out-sql backend/data/seed_moodle_links.sql
cd backend
npx wrangler d1 execute DB --local --file data/seed_moodle_links.sql
```

Only accepted matches are published to `course_learning_links`.
Unmatched rows remain in `moodle_course_matches` for diagnostics and are not
shown as links. Accepted Moodle links are inserted conditionally by stable
`period_id` and course number, so stale local D1 catalogs skip missing ALMA rows
instead of aborting the whole seed.

## Remote backup/export checklist

Before any remote rebuild or destructive migration:

1. Confirm the active Cloudflare account and list D1 databases with `npx wrangler d1 list`.
2. Export/backup both databases, especially active `studyplanner-db` and previous test `studyplaner-db-test`.
3. Store dumps outside the repo, not in `backend/.tmp/` if they contain private user data.
4. Verify local migration plus API behavior against the checked `DB` binding.
5. Ask for explicit approval before applying remote schema changes, deleting remote tables, or switching the app to a different D1 database.

Remote migration command from the repo root, after approval only:

```bash
npm run db:verify-config
npm run db:migrate:remote
```

## Notes

- The first D1 migration intentionally excludes the SQLite FTS tables.
- `backend/data/alma.sqlite` remains the local source for catalog/course data inside generated D1 imports.
- `backend/scripts/export_sqlite_to_d1.py` appends the supported PO 2021 study-program/regulation seed from `einzupflegene_po/`.

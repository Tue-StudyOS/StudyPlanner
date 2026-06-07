# Cloudflare Migration Test Plan

This document is the practical test guide for the `cloudflare-migration-test` branch.

## Goal

Validate the Cloudflare migration safely without touching the current `main` branch or a future production setup.

The branch already contains:

- Cloudflare Pages-ready frontend configuration
- Cloudflare Python Worker scaffold
- Cloudflare D1 schema migration generated from `backend/data/alma.sqlite`
- SQLite-to-D1 export script
- local Worker routes for testing D1 access

## Important current state

- The public catalog now reads from the Worker API and D1.
- The transcript/progress area still contains temporary example completed-course bootstrap data.
- The backend Worker already reads from D1.
- The first D1 migration intentionally excludes SQLite full-text search tables.
- The local scraper stays local and is not part of the Cloudflare deployment.

This means tomorrow's test proves:

- Pages hosting works
- Worker deployment works
- D1 schema and data import work
- Worker endpoints work against D1
- the public catalog can already run against the deployed API

## Recommended test resources

Use separate Cloudflare test resources.

- Pages project: `studyplanner-web-test`
- Worker: `studyplanner-api-test`
- D1 database: `studyplanner-db`

Recommended branch for all tests:

- `cloudflare-migration-test`

## Decisions to make before starting

### 1. D1 location

Choose one of these:

- `--location weur` for Western Europe
- `--jurisdiction eu` for EU-only placement

Recommendation:

- use `--jurisdiction eu` if you want to prepare for future user data
- use `--location weur` if you want the simplest nearby test setup now

### 2. Backend deployment method

Recommendation for the first test:

- deploy the Worker with Wrangler CLI first
- do **not** start with automatic Git deployment for the backend

This is simpler and easier to debug.

### 3. Pages deployment method

Two safe options:

- CLI deploy for a quick one-off test
- Git-connected Pages project for branch preview testing

Recommendation for tomorrow:

- if you want speed: use CLI
- if you want a more realistic workflow: connect Pages to GitHub and set the branch to `cloudflare-migration-test`

### 4. CORS policy for the test

The Worker uses `ALLOWED_ORIGINS`.

For the first test you need to decide between:

- strict origin list
- temporary wildcard `*`

Recommendation:

- keep it strict if possible
- if CORS blocks testing, temporarily use `*` only for the test Worker

## Prerequisites

Install and log into Wrangler:

```bash
npm install -g wrangler
npx wrangler login
```

Optional sanity checks:

```bash
npx wrangler --version
node --version
python --version
```

## Step 1: push the test branch

From the repository root:

```bash
git push -u origin cloudflare-migration-test
```

## Step 2: run the local checks first

### 2.1 Frontend build

```bash
cd frontend
npm install
npm run build
cd ..
```

Expected result:

- `frontend/dist` is created
- the build finishes without errors

### 2.2 Generate the D1 seed SQL from the tracked SQLite database

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

Expected result:

- `backend/.tmp/d1-seed.sql` is created

Note:

- the file is large
- this is expected because it contains the full SQL insert dump

### 2.3 Apply the D1 schema locally

```bash
cd backend
npx wrangler d1 migrations apply studyplanner-db --local --persist-to .wrangler/state
cd ..
```

### 2.4 Import the local D1 seed

```bash
cd backend
npx wrangler d1 execute studyplanner-db --local --persist-to .wrangler/state --file .tmp/d1-seed.sql > ../d1-local-import.log
cd ..
```

Why the log file is recommended:

- the import output is very long
- keeping it in a file is easier than reading it in the terminal

### 2.5 Verify local D1 data

```bash
cd backend
npx wrangler d1 execute studyplanner-db --local --persist-to .wrangler/state --command "SELECT (SELECT COUNT(*) FROM courses) AS courses_count, (SELECT COUNT(*) FROM catalog_nodes) AS catalog_nodes_count, (SELECT COUNT(*) FROM study_programs) AS study_programs_count;" --json
cd ..
```

Expected values from the current dataset:

- `courses_count = 1265`
- `catalog_nodes_count = 18376`
- `study_programs_count = 6`

### 2.6 Run the Worker locally against the persisted D1 state

Important:

- use `--persist-to .wrangler/state`
- otherwise the Worker may start with a different empty local D1 state

```bash
cd backend
npx wrangler dev --persist-to .wrangler/state
```

In another terminal test these routes:

```bash
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/api/courses?limit=2"
curl "http://127.0.0.1:8787/api/courses/91"
curl http://127.0.0.1:8787/api/study-programs
```

Expected result:

- `/health` returns `ok: true`
- `/api/courses?limit=2` returns two D1-backed courses
- `/api/courses/91` returns a populated course detail payload
- `/api/study-programs` returns six study programs

If this fails, do not continue to remote deployment yet.

## Step 3: create the remote test D1 database

From `backend/` choose one of the following.

### Option A: western Europe

```bash
cd backend
npx wrangler d1 create studyplanner-db --location weur
```

### Option B: EU-only

```bash
cd backend
npx wrangler d1 create studyplanner-db --jurisdiction eu
```

Copy the returned values and update `backend/wrangler.toml`:

- `database_name = "studyplanner-db"`
- `database_id = "<real id from Cloudflare>"`

Optional but recommended for clarity during testing:

- keep the repo branch as `cloudflare-migration-test`
- deploy the Worker under the explicit test name `studyplanner-api-test`

## Step 4: apply the schema to the remote test D1 database

```bash
cd backend
npx wrangler d1 migrations apply studyplanner-db --remote
cd ..
```

## Step 5: import the seed data into the remote test D1 database

```bash
cd backend
npx wrangler d1 execute studyplanner-db --remote --file .tmp/d1-seed.sql > ../d1-remote-import.log
cd ..
```

Notes:

- this may take a while
- the log file may become large
- if this step fails, keep the log file and inspect the failing statement

## Step 6: verify the remote D1 import

```bash
cd backend
npx wrangler d1 execute studyplanner-db --remote --command "SELECT (SELECT COUNT(*) FROM courses) AS courses_count, (SELECT COUNT(*) FROM catalog_nodes) AS catalog_nodes_count, (SELECT COUNT(*) FROM study_programs) AS study_programs_count;" --json
cd ..
```

Expected values:

- `courses_count = 1265`
- `catalog_nodes_count = 18376`
- `study_programs_count = 6`

## Step 7: deploy the Worker test instance

From `backend/`:

```bash
cd backend
npx wrangler deploy --name studyplanner-api-test
cd ..
```

Expected result:

- a `workers.dev` URL is returned

Example shape:

```text
https://studyplanner-api-test.<your-subdomain>.workers.dev
```

## Step 8: verify the deployed Worker

Replace the base URL below with your real Worker URL.

```bash
curl https://studyplanner-api-test.<your-subdomain>.workers.dev/health
curl "https://studyplanner-api-test.<your-subdomain>.workers.dev/api/courses?limit=2"
curl "https://studyplanner-api-test.<your-subdomain>.workers.dev/api/courses/91"
curl https://studyplanner-api-test.<your-subdomain>.workers.dev/api/study-programs
```

Expected result:

- the responses should match the local shape
- `/health` should report a reachable configured database

## Step 9: create and test the Pages frontend

## Option A: CLI-based Pages test

Create the Pages project:

```bash
npx wrangler pages project create studyplanner-web-test --production-branch cloudflare-migration-test
```

Build and deploy:

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name studyplanner-web-test --branch cloudflare-migration-test
cd ..
```

## Option B: Git-connected Pages project

Cloudflare Dashboard:

```text
Workers & Pages → Create application → Pages → Import an existing Git repository
```

Use these settings:

```text
Repository: this repository
Root directory: frontend
Build command: npm run build
Build output directory: dist
Production branch: cloudflare-migration-test
```

## Step 10: configure the frontend environment variable

Set this in Cloudflare Pages for the test project:

```text
VITE_API_BASE_URL=https://studyplanner-api-test.<your-subdomain>.workers.dev
```

Important current limitation:

- the frontend does not fully use this variable yet
- setting it now is still useful so the environment is ready for the next step

## Step 11: verify the Pages deployment

Test the following manually in the browser:

- `/`
- `/catalog`
- `/favorites`
- `/transcript`

Expected result:

- all pages load
- direct navigation to sub-routes works
- the app loads as a Cloudflare Pages SPA

This works because `frontend/public/_redirects` was added.

## Step 12: if you want to connect custom test domains

Optional split:

```text
www-test.example.com  -> Pages project
api-test.example.com  -> Worker
```

If you do this, update:

- `VITE_API_BASE_URL`
- `ALLOWED_ORIGINS`

## Known open questions

### 1. Remote seed import size

Open question:

- will the full remote SQL seed import stay reliable enough as the dataset grows?

If it becomes unstable later, the likely next step is:

- chunked import
- or a dedicated importer script

### 2. Full-text search

Open question:

- how should SQLite FTS be replaced in Cloudflare?

This is not solved in the first migration.

### 3. Remaining personal-data cutovers

Open question:

- when will favorites, progress, and transcript data move fully from temporary browser/bootstrap state to authenticated persistence?

This is the main remaining application integration step after the catalog cutover.

### 4. User accounts and persistence

Open question:

- what auth provider should be used later?
- where should favorites, progress, and completed courses be stored?
- should progress calculation stay client-side or move server-side?

### 5. Cloudflare environment strategy

Open question:

- do you want a dedicated preview/test/prod setup with separate D1 databases?

For a future safer setup, this would be useful:

- preview D1
- test/staging Worker
- production Worker

## Recommended tomorrow checklist

- [ ] Push `cloudflare-migration-test`
- [ ] Run frontend build locally
- [ ] Generate `backend/.tmp/d1-seed.sql`
- [ ] Apply local D1 migration
- [ ] Import local D1 seed
- [ ] Verify local table counts
- [ ] Start local Worker with `--persist-to .wrangler/state`
- [ ] Test `/health`
- [ ] Test `/api/courses?limit=2`
- [ ] Test `/api/courses/91`
- [ ] Create `studyplanner-db`
- [ ] Update `backend/wrangler.toml` with the real D1 test id
- [ ] Apply remote D1 migration
- [ ] Import remote D1 seed
- [ ] Verify remote table counts
- [ ] Deploy Worker as `studyplanner-api-test`
- [ ] Test deployed Worker routes
- [ ] Create or connect `studyplanner-web-test`
- [ ] Set `VITE_API_BASE_URL`
- [ ] Test frontend routes on Pages
- [ ] Decide next step: API integration, auth, or user data model

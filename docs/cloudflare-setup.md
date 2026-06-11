# Cloudflare Setup

See `docs/cloudflare-runtime-config.md` for the current active resource names. At the moment the app must stay bound to `studyplaner-db-test` (`297f7a28-9069-431d-b989-49acf2537513`); `studyplanner-db` is reserved for a later production cutover.

## 1. Prerequisites

Install Wrangler globally or use `npx`.

```bash
npm install -g wrangler
```

Login:

```bash
npx wrangler login
```

## 2. Confirm the active D1 database

The current active database already exists in Cloudflare:

```text
studyplaner-db-test = 297f7a28-9069-431d-b989-49acf2537513
```

Run the config guard before applying migrations or deploying:

```bash
npm run db:verify-config
```

## 3. Apply the schema migration

Local:

```bash
npm run db:migrate:local
```

Remote, only after explicit approval:

```bash
npm run db:migrate:remote
```

## 4. Export the tracked SQLite data for D1

From the repo root:

```bash
python backend/scripts/export_sqlite_to_d1.py --data-out backend/.tmp/d1-seed.sql
```

## 5. Import the generated data dump into D1

Local:

```bash
cd backend
npx wrangler d1 execute DB --local --file .tmp/d1-seed.sql
```

Remote, only after explicit approval and backup:

```bash
cd backend
npx wrangler d1 execute DB --remote --file .tmp/d1-seed.sql
```

## 6. Run the backend locally

```bash
cd backend
npx wrangler dev
```

## 7. Deploy the backend

```bash
npm run db:verify-config
npm run deploy:backend
```

## 8. Connect the frontend in Cloudflare Pages

Cloudflare Dashboard:

```text
Workers & Pages → Create application → Pages → Import an existing Git repository
```

Use these values:

```text
Repository: this repository
Root directory: frontend
Build command: npm run build
Build output directory: dist
Production branch: main
```

Set this environment variable in Pages:

```text
VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev
```

## 9. Connect the backend in Cloudflare Workers

Cloudflare Dashboard:

```text
Workers & Pages → Create application → Worker → Import an existing Git repository
```

Use these values:

```text
Repository: this repository
Root directory: repository root
Build command: automatic / none
Deploy command: npm run deploy:backend
```

Make sure the Worker has the `DB` D1 binding, the `ALLOWED_ORIGINS` variable, and the `AUTH_TOKEN_SECRET` Worker secret.

Recommended `ALLOWED_ORIGINS` value for Pages production plus preview deployments:

```text
https://studyplaner.pages.dev,https://*.studyplaner.pages.dev,http://localhost:5173
```

## 10. Domains

Recommended split:

```text
www.example.com  → Cloudflare Pages
api.example.com  → Cloudflare Worker
```

After connecting domains, update:

- `VITE_API_BASE_URL`
- `ALLOWED_ORIGINS`

## 11. Team access

GitHub:

- Add collaborators or use a GitHub organization.
- Protect `main`.
- Prefer pull requests for all production changes.

Cloudflare:

- Invite team members through account members.
- Avoid giving everyone super-admin access.
- Keep at least two trusted admins for production access.

## 12. Known limits for the first migration

- The frontend still relies on mock/bootstrap JSON.
- Full-text search from SQLite is not migrated in the first D1 step.
- The local scraper stays local and is not deployed to Cloudflare.

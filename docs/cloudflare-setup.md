# Cloudflare Setup

## 1. Prerequisites

Install Wrangler globally or use `npx`.

```bash
npm install -g wrangler
```

Login:

```bash
npx wrangler login
```

## 2. Create the D1 database

From `backend/`:

```bash
cd backend
npx wrangler d1 create studyplanner-db
```

Copy the returned `database_id` into `backend/wrangler.toml`.

## 3. Apply the schema migration

Local:

```bash
cd backend
npx wrangler d1 migrations apply studyplanner-db --local
```

Remote:

```bash
cd backend
npx wrangler d1 migrations apply studyplanner-db --remote
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
npx wrangler d1 execute studyplanner-db --local --file .tmp/d1-seed.sql
```

Remote:

```bash
cd backend
npx wrangler d1 execute studyplanner-db --remote --file .tmp/d1-seed.sql
```

## 6. Run the backend locally

```bash
cd backend
npx wrangler dev
```

## 7. Deploy the backend

```bash
cd backend
npx wrangler deploy
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
VITE_API_BASE_URL=https://api.example.com
```

## 9. Connect the backend in Cloudflare Workers

Cloudflare Dashboard:

```text
Workers & Pages → Create application → Worker → Import an existing Git repository
```

Use these values:

```text
Repository: this repository
Root directory: backend
Build command: automatic / none
Deploy command: npx wrangler deploy
```

Make sure the Worker has the `DB` D1 binding and the `ALLOWED_ORIGINS` variable.

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

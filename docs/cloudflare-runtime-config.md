# Cloudflare runtime configuration

This is the canonical repo-side reference for the Cloudflare Worker, Pages API URL, and D1 database names.

## Current active resources

| Purpose | Name | ID / URL | Notes |
| --- | --- | --- | --- |
| Active D1 runtime database | `studyplanner-db` | `80ca9092-ddc6-454a-b04a-8ccae85ef2f5` | Production database since the approved `integrate_new_db` cutover (multi-period ALMA catalog). |
| Previous test D1 | `studyplaner-db-test` | `297f7a28-9069-431d-b989-49acf2537513` | Superseded by the cutover; delete after the new database is verified. |
| Canonical Worker | `studyplanner-api` | `https://studyplanner-api.ben-tischberger.workers.dev` | Pages should call this URL. |
| Legacy typo Worker | `studyplaner-api` | `https://studyplaner-api.ben-tischberger.workers.dev` | Keep only as a temporary compatibility endpoint while old Pages builds/env vars exist. |
| Pages project | `studyplaner` | `https://studyplaner.pages.dev` | Build-time `VITE_API_BASE_URL` must point at the canonical Worker. |

The Worker D1 binding name is always `DB`. Helper commands intentionally use `DB` so migrations follow the checked `backend/wrangler.toml` binding instead of duplicating a database name in multiple scripts.

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
- `frontend/wrangler.toml` and `frontend/.env.production` point Pages builds at `studyplanner-api`
- `.env.example` documents the active D1 name and id
- package scripts keep using the checked `DB` binding

The GitHub workflow `.github/workflows/verify-cloudflare-config.yml` runs the same check. To make it hard for future agents to change these values accidentally, require that workflow in GitHub branch protection for `main`.

## Deploy and smoke-test checklist

```bash
npm run db:verify-config
npm run deploy:backend
```

Then verify:

```bash
curl https://studyplanner-api.ben-tischberger.workers.dev/health
curl https://studyplanner-api.ben-tischberger.workers.dev/api/auth/session \
  -H "Authorization: Bearer invalid-token"
```

Expected auth-session response for an invalid token is `{"authenticated": false, "user": null}`. If it returns `AUTH_TOKEN_SECRET must be configured as a Worker secret`, the Worker secret is missing on the script that received the request.

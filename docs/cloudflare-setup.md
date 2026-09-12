# Deploy to Cloudflare

For development on your computer, use the [local setup](cloudflare-development.md).
This guide deploys the existing production resources listed in
[runtime configuration](cloudflare-runtime-config.md).

## Before deployment

From the repository root:

```powershell
npm run db:verify-config
npm run test:frontend
npm --prefix frontend run lint
npm --prefix frontend run build
```

Use a dedicated branch. Merge completed work into main with a non-fast-forward
merge, as required by [AGENTS.md](../AGENTS.md). Authenticate Wrangler with
`npx wrangler login` when deploying from a developer machine.

The active database already exists: **studyplanner-db**
(`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`), binding **DB**.
Do not create or swap a database for a normal deployment. Apply any required
migrations locally first. Remote schema changes require approval and a backup:

```powershell
# Repository root, after approval
npm run db:migrate:remote
```

Do not use the legacy SQLite bootstrap seed as a production restore. See
[catalog refresh](cloudflare-runtime-config.md#catalog-refresh).

## Backend Worker

The deployment script runs the config guard before Wrangler:

```powershell
# Repository root
npm run deploy:backend
```

The Worker requires the production AUTH_TOKEN_SECRET secret, the DB binding and
ALLOWED_ORIGINS. To provision a missing production secret, enter it at Wrangler's
interactive prompt:

```powershell
cd backend
npx wrangler secret put AUTH_TOKEN_SECRET
```

Local .dev.vars values are not uploaded. Rotating an existing signing secret
invalidates sessions, so do not replace it as a routine setup step.

## MCP Worker

Only needed when the adapter changes, or during initial setup. From the root:

```powershell
npm run test:mcp
npm run build:mcp
cd integrations/studyplanner-mcp
npx wrangler deploy
```

Deploy the API before the MCP adapter, and the adapter before a Pages gateway
change that depends on it.

## Frontend and Pages Functions

From the repository root, this builds with an explicit production API origin and
deploys a **branch preview**:

```powershell
cd frontend
$env:VITE_API_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'
npm run build
npx wrangler pages deploy dist --project-name studyplaner --branch <feature-branch>
Remove-Item Env:VITE_API_BASE_URL
```

Replace the branch placeholder with your actual feature branch. Run this in a
dedicated terminal so the temporary env override does not affect local development.

For an approved production release, build the completed main checkout and use:

```powershell
npx wrangler pages deploy dist --project-name studyplaner --branch main
```

That last command runs from frontend/ after the same build step. Explicit branch
selection avoids publishing a feature branch to the wrong destination.

Vite reads VITE_API_BASE_URL at build time. If it is absent, deployed hosts use
same-origin /api/*; a configured value points browsers directly at that origin.
Do not assume Wrangler's [vars] supplies the variable to a plain local Vite build.
Pages gateway forwarding is configured separately with STUDYPLANNER_API_ORIGIN
and the service bindings in frontend/wrangler.toml.

## Automatic deployments

For a Git-connected Pages project, configure:

| Setting | Value |
| --- | --- |
| Project | studyplaner |
| Root directory | frontend |
| Build command | npm run build |
| Output directory | dist |
| Production branch | main |
| Build variable | VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev |

Configure preview variables and gateway bindings as well if branch previews are
enabled. Such previews share production services unless explicitly isolated.

A push triggers a deployment **only if** the corresponding Cloudflare Git
integration and branch/watch-path settings are enabled. Repository files alone
do not establish that dashboard state. The checked GitHub workflow
[verify-cloudflare-config.yml](../.github/workflows/verify-cloudflare-config.yml)
verifies config; it does not deploy.

For Worker Git integration, use the repository root and deploy command
`npm run deploy:backend`. Verify the Cloudflare deployment result after a push.

## Smoke checks

```powershell
Invoke-RestMethod https://studyplanner-api.ben-tischberger.workers.dev/health
Invoke-RestMethod 'https://studyplaner.pages.dev/api/catalog/courses?limit=2'
Invoke-RestMethod https://studyplaner.pages.dev/api/ai/meta
```

Also check the catalog in a signed-out browser, refresh a course detail URL, and
verify login, planner persistence and the privacy page when those surfaces change.
For MCP discovery use the [integration smoke checks](ai-integrations-setup.md).

## Team access

Use individual Cloudflare accounts, MFA and the smallest sufficient role. Protect
main and require the config verification check. Review account access after team
changes; keep private access records outside the repository.

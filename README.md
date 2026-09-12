# StudyPlanner

Find your next course, plan your semester, and keep track of your degree at the
University of Tübingen. StudyPlanner is an independent student project for
Computer Science and related study programs.

**[Open the course catalog](https://studyplaner.pages.dev/catalog)** ·
[Local setup](docs/cloudflare-development.md) · [Documentation](docs/README.md)

[![StudyPlanner's live catalog with search, course cards, ECTS and study-area badges](docs/images/catalog.png)](https://studyplaner.pages.dev/catalog)

*The live catalog, captured on 11 September 2026.*

## What you can do

- Browse and filter the public ALMA catalog, with course details and schedules.
- Save favorites and build semester plans with a weekly calendar and calendar export.
- Import a Transcript of Records PDF in your browser, review results, and track progress.
- Check course assignments against your examination regulation and balance planned courses.
- Search the public catalog through the read-only [AI integrations](docs/ai-integrations-setup.md).

Catalog browsing is public. Personal plans and progress use an account. Tour
examples are isolated from real account data.

## Run locally

First time here? Follow the **[one-time setup](docs/cloudflare-development.md#one-time-setup)**
to install dependencies, configure a local auth secret, and prepare local D1.
Use Node.js 22.13+ and Python 3.11+. The setup guide records a known large-seed
import failure on fresh local databases; existing populated local databases can
use the daily commands below.

Then open **two terminals, both starting at the repository root**:

```powershell
# Frontend — http://localhost:5173
cd .\frontend\
npm run dev
```

```powershell
# Backend — http://localhost:8787
cd .\backend\
npx wrangler dev
```

Open [localhost:5173/catalog](http://localhost:5173/catalog).
These commands run development servers; they do not deploy to Cloudflare.
With `VITE_API_BASE_URL` unset, the local frontend uses `http://localhost:8787`.
Keep both servers running. See [troubleshooting](docs/cloudflare-development.md#troubleshooting)
if the catalog or login does not load.

## Project layout

| Directory | Purpose |
| --- | --- |
| [frontend/](frontend/README.md) | React 19, Vite, TypeScript, Tailwind CSS 4 and Pages Functions |
| [backend/](backend/README.md) | Python Cloudflare Worker, D1 migrations and import helpers |
| [data_collection/](data_collection/README.md) | Local ALMA and learning-platform collection tools |
| [integrations/studyplanner-mcp/](integrations/studyplanner-mcp/README.md) | Public MCP adapter |
| [docs/](docs/README.md) | Setup, deployment, feature contracts and operational notes |

## Checks

Run from the repository root:

```powershell
npm run test:frontend
npm --prefix frontend run lint
npm --prefix frontend run build
npm run db:verify-config
```

For transcript parser changes, also run `npm --prefix frontend run validate:transcripts`
with the local fixtures described in the [frontend guide](frontend/README.md).
See [AGENTS.md](AGENTS.md) for branch, test and commit conventions.

## Deployment and operations

Use the [deployment guide](docs/cloudflare-setup.md) for Pages and Worker commands.
The active D1 database is `studyplanner-db`, bound as `DB`. Do not recreate or swap
it during deployment. Keep `AUTH_TOKEN_SECRET` out of Git.

[Runtime configuration](docs/cloudflare-runtime-config.md) documents resource names,
catalog refresh safeguards and the production-wide simulated-semester toggle.
[Authentication](docs/authentication.md) explains cookies and CSRF protection.

[Privacy](https://studyplaner.pages.dev/privacy) ·
[Imprint](https://studyplaner.pages.dev/impressum)

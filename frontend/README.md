# StudyPlanner frontend

React 19, TypeScript, Vite and Tailwind CSS 4. Pages Functions live in `functions/`;
the browser application lives in `src/`.

## Run locally

Complete the [one-time backend and D1 setup](../docs/cloudflare-development.md#one-time-setup),
then start Vite from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open [localhost:5173/catalog](http://localhost:5173/catalog). Keep
`npx wrangler dev` running from `backend/` in another terminal.

## API configuration

`src/shared/utils/apiBaseUrl.ts` resolves the API base as follows:

1. A non-empty `VITE_API_BASE_URL` wins, with its trailing slash removed.
2. On localhost or 127.0.0.1, the default is `http://localhost:8787`.
3. On other hosts, the default is same-origin `/api/*`.

Use localhost:5173 for the checked backend CORS allow-list. Vite reads overrides
from frontend env files and the shell; editing an env file requires a restart.
Wrangler's `[vars]` does not configure a plain local `npm run build`.

For deliberate testing with a deployed account, see
[the production API override](../docs/cloudflare-development.md#troubleshooting).
Sessions use HttpOnly cookies and CSRF proofs; see [authentication](../docs/authentication.md).

## Checks

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

Unit tests live in `tests/` and run with Node's TypeScript stripping. Runtime
imports in tested modules must use explicit `.ts` extensions.

For transcript parser changes:

```powershell
npm run test:transcript-parser
npm run validate:transcripts
```

The validation script reads local PDF fixtures; inspect
`scripts/validate-transcript-pdfs.ts` for its fixture paths. Personal PDFs must
remain uncommitted. For UI changes, check 320px, 375px, 768px and desktop in light
and dark mode using the [mobile checklist](../docs/mobile-testing.md).

## Build and deploy

`npm run build` typechecks and creates `dist/`. `npm run preview` previews that
static build; it does not run Pages Functions. Test the gateway with
`npx wrangler pages dev dist --port 8789` and the backend/MCP processes in the
[AI integration guide](../docs/ai-integrations-setup.md#local-smoke-test).

See [Cloudflare deployment](../docs/cloudflare-setup.md) for explicit build-time
API configuration and branch preview versus production deployment.

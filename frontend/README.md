# StudyPlanner Frontend

## Quick start

```bash
cd frontend
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`.

## Important local API behavior

When the frontend runs on `localhost` and `VITE_API_BASE_URL` is not set, it calls the local Worker at:

```text
http://localhost:8787
```

That means login, register, favorites, planner, transcript, and other personal features require the backend to run too.

## Test this frontend branch with your existing deployed account

Create `frontend/.env.local` (gitignored):

```bash
VITE_API_BASE_URL=https://studyplanner-api.ben-tischberger.workers.dev
```

Then restart Vite:

```bash
npm run dev
```

Now `http://localhost:5173` talks to the same backend as `https://studyplaner.pages.dev`, so your deployed account can be used locally.

## Full local auth testing

For isolated local users you also need:

1. a local D1 database with migrations + seed data
2. `backend/.dev.vars` with `AUTH_TOKEN_SECRET`
3. `npx wrangler dev --persist-to .wrangler/state`

`npx wrangler login` alone is not enough for auth. It logs the CLI into Cloudflare, but it does not create `AUTH_TOKEN_SECRET` for local Worker runs.

See the repo root `README.md` for the full backend + D1 setup.

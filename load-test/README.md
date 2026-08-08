# Concurrent-user stress test

Runbook for testing StudyPlanner at ~20 simultaneous users. Findings from each
run go in `docs/load-test-<yyyy-mm>.md`.

## What this measures, and why it looks like this

Three risks motivated this harness. Only two need a load generator:

1. **Shared-IP rate limiting.** *Confirmed, then fixed* — see
   `docs/load-test-2026-08.md`. Login used to allow 10 requests / 15 min keyed on
   `sha256(CF-Connecting-IP)`, so twenty students behind one campus NAT shared
   one budget and users 11–20 got `429`. Login is now keyed per account, counts
   only failed attempts, and allows 500 per 15 min. The remaining volume
   policies (feedback, AI catalog, client errors) are still per IP.
2. **Isolates hanging under concurrent large responses.** *Cause identified —
   see the handoff at the top of `docs/load-test-2026-08.md`.* A keep-alive
   connection pins to one Worker isolate, and that isolate hangs when too many
   large response bodies are in flight at once; it then stays hung, so every
   later request from that user fails.

   > This was previously attributed here to the Pyodide GIL fault
   > ([workerd#6624](https://github.com/cloudflare/workerd/issues/6624)) and
   > described as unfixable in this repo. **Both claims were wrong.** The
   > captured signature differs from that issue (`GIL` and `PyProxy` never
   > appear in our logs), and the production trigger turned out to be
   > application code requesting many large payloads in parallel.
3. **Sequential D1 round-trips.** `/api/me/progress` issues ~7 sequential
   queries, the catalog service ~19. Expect p95 to degrade before anything
   errors.

Four design decisions follow from that:

- **Load is generated over HTTP, not by driving 20 browsers.** The crash surface
  is server-side isolate scheduling; the server cannot tell a browser from a
  load generator. Twenty real browsers on one machine would be client-CPU-bound
  and would measure the test runner instead. What browsers *would* catch —
  whether the app still feels usable — is covered by keeping one real browser
  open during the run as a canary.
- **The request sequence is recorded, not hand-written.** A hand-written list
  tests an assumption about what the app does. `build-scenario.mjs` derives it
  from `sessionStorage['studyplanner:api-request-log']`, which the app already
  maintains (`frontend/src/shared/utils/apiRequestLog.ts`).
- **Sessions are pre-minted.** This predates the limiter fix, when logging in
  inside the test would have hit the 10/15min ceiling at VU 11 and measured the
  limiter instead of the app. It is still worth keeping: a run that spends its
  first 20 iterations on PBKDF2 measures registration cost, not steady-state
  traffic. `mint-sessions.mjs` collects cookies out of band; they last 30 days.
- **The target is the Worker origin**
  (`https://studyplanner-api.ben-tischberger.workers.dev`), because that is what
  the deployed frontend calls. `VITE_API_BASE_URL` is baked into the Pages
  build, so browsers skip the same-origin `/api/*` Pages Function entirely.
  Verified against the live bundle — see `docs/load-test-2026-08.md` Phase 0.
  (The `caches.default` catalog cache in `proxy.ts:65` consequently never runs
  for web users.)
- **Each VU does one expensive first load, then a lighter steady state.** The
  frontend caches the catalog, progress and planner payloads in `sessionStorage`
  for 24 h (`frontend/src/shared/utils/sessionCache.ts`), so a real user fetches
  the 1.43 MB catalog once per browser session. Replaying it every iteration
  would invent load that does not exist. `scenario.js` runs the first-load steps
  on `__ITER === 0` only.

## Prerequisites

k6 as a standalone binary — it is not an npm dependency of this repo:

```bash
winget install k6 --source winget
```

Node 18+ for the two `.mjs` helpers (no packages needed; they use built-in
`fetch`).

Pick a throwaway password and export it once per shell. It is never stored in
the repo:

```bash
export LOADTEST_PASSWORD='<throwaway value>'
```

## One-time setup

### 1. Seed the accounts

```bash
py backend/scripts/seed_load_test_users.py --count 20 --apply
```

Writes `loadtest-01@example.com` … `loadtest-20@example.com` to the production
D1. Dry-run without `--apply`. Re-running is safe — credentials are upserted and
existing planner data is left alone.

These accounts are retained after a run, like the `debug-onboarding-*` accounts
in `CLAUDE.md`. Exclude them from user counts.

### 2. Record a real session

The committed `recorded-session.json` starts as a **placeholder** derived from
reading `frontend/src`. Replace it with a real recording before trusting any
results; `scenario.js` warns until you do.

1. Open `https://studyplaner.pages.dev` and log in as `loadtest-01@example.com`.
2. Walk a representative session: browse the catalog, open the planner, add a
   course, look at progress.
3. In DevTools console, dump the log the app already kept:

   ```js
   copy(sessionStorage.getItem('studyplanner:api-request-log'))
   ```

4. Save the clipboard to a file and convert it:

   ```bash
   node load-test/build-scenario.mjs raw-dump.json
   ```

The converter drops endpoints that must not be replayed (login, register,
logout, feedback, client-errors) and prints why for each.

Re-record whenever the frontend's data fetching changes.

### 3. Mint sessions

```bash
node load-test/mint-sessions.mjs --count 20
```

Takes ~15 minutes: it logs in 9 accounts, waits for the next fixed 15-minute
rate-limit window, then does the rest. Output `sessions.json` holds live session
cookies — it is gitignored, treat it as a credential file. Valid 30 days, so one
mint covers many runs.

## Running

Smoke check first. It must pass before any multi-VU run:

```bash
k6 run --vus 1 --iterations 1 load-test/scenario.js
```

Then the real run — 20 VUs, ramp over 30s, hold 5 minutes:

```bash
k6 run load-test/scenario.js
```

While it runs, in two other terminals:

```bash
npx wrangler tail studyplanner-api --format pretty
```

…and keep one real browser open on the app as a usability canary. A 500 in k6
tells you *that* it broke; the tail tells you whether Pyodide init was the
cause.

Phase D, separately, at least 15 minutes after minting:

```bash
k6 run -e LOADTEST_PASSWORD="$LOADTEST_PASSWORD" load-test/login-burst.js
```

## Reading the result

The run **fails** if either gate trips:

| Gate | Meaning |
| --- | --- |
| `server_errors > 0` | 5xx observed — the finding. Correlate with `wrangler tail`. |
| `rate_limited_429 > 0` | The limiter was hit, so the run measured the limiter. Results are invalid; re-mint sessions and re-run. |
| `http_req_failed > 1%` | Non-5xx failures — timeouts, connection resets. |
| `http_req_duration p95 > 1500ms` | Latency budget exceeded. |

Full per-endpoint data lands in `load-test/results/summary.json`. Quote raw
numbers from it in the report rather than summarising twice.

## Safety

- The run writes to the **production** D1. Writes are confined to the
  `loadtest-*` accounts' own semester plans.
- `POST /api/feedback` and `/api/client-errors` are excluded by
  `build-scenario.mjs` — both are hourly-limited per IP and would pollute the
  diagnostics view.
- Run at a low-traffic hour; a 20-VU burst can briefly affect real users.

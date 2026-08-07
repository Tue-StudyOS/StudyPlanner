# Load test: ~20 concurrent users (August 2026)

Report for the concurrent-user stress test. The harness and the reasoning behind
its design live in [`load-test/README.md`](../load-test/README.md).

| | |
| --- | --- |
| Target | `https://studyplanner-api.ben-tischberger.workers.dev` (see Phase 0) |
| Frontend | Pages `studyplaner.pages.dev` |
| Backend | Worker `studyplanner-api`, D1 `studyplanner-db` |
| Harness | k6 (standalone binary, not an npm dependency) |
| Accounts | `loadtest-01@example.com` … `loadtest-20@example.com` |

## Status

| Phase | What it establishes | Status |
| --- | --- | --- |
| 0 — live reconnaissance | Which origin users actually hit; single-user latency | **Done (2026-08-07)** |
| A — rate-limit arithmetic | Whether 20 users behind one IP can even sign in | **Done — confirmed live** |
| B — baseline | Uncontended per-endpoint latency, authenticated | Not run |
| C — 20 concurrent users | 5xx under isolate fan-out; p95 under load | Not run |
| D — login burst | How CPU-bound logins queue | **Superseded — the 500s reproduced without concurrency** |

### Bottom line so far

The production 500s come from a Pyodide runtime fault
(`Attempted to use PyProxy when Python GIL not held`), tracked upstream as
[cloudflare/workerd#6624](https://github.com/cloudflare/workerd/issues/6624) and
still open. The upstream report describes it as a race in isolate re-use that
needs only 3–5 concurrent requests, which is well below the "20 users" this test
was built for — so it is a *low*-concurrency bug, not a scale bug.

> Correction to the first draft of this report, which said the fault was "not
> load-dependent at all". That was read off a run of sequential logins, but a
> browser was open against the same Worker throughout, so the run was never
> actually free of concurrency.

### What was fixed (2026-08-07)

See [Fixes](#fixes) for the detail and the verification of each.

| Fault | Status |
| --- | --- |
| Login CPU cost (Mode A) | **Fixed** — PBKDF2 moved to native WebCrypto |
| Shared-IP login lockout | **Fixed** — keyed per account, ceiling raised to 500 |
| Outages consuming login budget | **Fixed** — only real failed attempts are charged |
| `/api/client-errors` storm | **Fixed** — retries absorb transients, reports capped |
| GIL fault (Mode B) | **Upstream, unfixed** — mitigated, not resolved |

### Setup state

Accounts seeded and 20 sessions minted (`load-test/sessions.json`, gitignored,
valid 30 days). Phases B–C additionally need a recorded authenticated session —
`load-test/recorded-session.json` is still a partial placeholder.

---

## Phase 0 — live reconnaissance

Measured against production on 2026-08-07 from a browser, anonymous, one user.
Timings come from the app's own request log
(`sessionStorage['studyplanner:api-request-log']`).

### The frontend does not use the Pages API proxy

Every API call from the deployed app goes to
`https://studyplanner-api.ben-tischberger.workers.dev` directly. The origin is
baked into the Pages build (`VITE_API_BASE_URL`, resolved by
[`apiBaseUrl.ts`](../frontend/src/shared/utils/apiBaseUrl.ts)) and appears in the
shipped bundle chunk.

Two consequences:

- **The load test must target the Worker origin**, not the Pages origin. An
  earlier draft of this plan had it backwards.
- **`functions/api/[[path]].ts` and its `caches.default` catalog caching are not
  in the production user path.** The `isPublicCatalogRequest` cache in
  [`proxy.ts:65`](../frontend/functions/_shared/proxy.ts) never runs for web
  users. The same-origin path still responds correctly if called directly, so
  this is dead weight rather than breakage — but it means an optimisation
  believed to be active is not.

### Single-user latency is the headline problem

| Request | Cold | Warm (browser cache bypassed) | Browser-cached |
| --- | --- | --- | --- |
| `GET /api/catalog/courses?limit=1000&period=all` (1.43 MB) | 12,693 ms | 3,280 ms | 26 ms |
| `GET /api/catalog/periods` | 1,582 ms | — | 23 ms |
| `GET /api/config` | 5,699 ms | 2,698 ms | — |
| `GET /api/auth/session` | 1,943 ms | 1,080 ms | — |

These are seconds, at **one** user with no contention. `/api/config` returns
`{"simulatedSemesterLabel": null}` and still took 2.7 s warm. Concurrency is not
the first problem here; baseline per-request cost is.

Sample sizes are small (1–2 observations per cell) — treat them as an order of
magnitude, not a measurement. Phase B replaces them with real percentiles.

### The catalog is cached, twice

Public catalog responses carry
`Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=86400`,
and the frontend additionally stores them in `sessionStorage` for 24 h
([`sessionCache.ts`](../frontend/src/shared/utils/sessionCache.ts)) — the
observed 1.43 MB entry.

So a real user fetches the 1.43 MB catalog **once per browser session**, not per
page view. A load scenario that re-requests it every iteration would invent
backend load that does not exist. `build-scenario.mjs` therefore splits the
recording into a first-load phase (run once per VU) and a steady state.

That split also reframes the test: twenty people opening the app at the start of
a lecture is a burst of twenty expensive session starts, not sustained traffic.
Whether the second through twentieth of those hit an edge cache or all pay the
~3.3 s origin cost is exactly what Phase C should answer.

---

## Phase A — shared-IP rate limiting

**This is the most likely real-world failure of the "20 users at once" scenario,
and it needs no load generator.**

`enforce_rate_limit` keys every policy on a hash of the client IP
([`request_rate_limit.py:36`](../backend/src/services/request_rate_limit.py)):

```python
client_ip = get_request_header(request, 'CF-Connecting-IP') or 'unknown'
return hashlib.sha256(client_ip.encode('utf-8')).hexdigest()
```

The policies ([`:19-23`](../backend/src/services/request_rate_limit.py)):

| Scope | Limit | Consequence for 20 users on one egress IP |
| --- | --- | --- |
| `auth_login` | 10 / 15 min | Users 11–20 get `429` and cannot sign in |
| `auth_registration` | 5 / hour | Only 5 people per hour can create an account |
| `ai_catalog` | 30 / min | Shared across everyone on that IP |
| `client_error` | 30 / hour | Error reports silently dropped for later users |
| `feedback` | 5 / hour | Shared across everyone on that IP |

Twenty students in one lecture hall on eduroam, or any campus NAT, present a
single `CF-Connecting-IP`. The limiter cannot distinguish them from one abusive
client.

The window is fixed rather than rolling — `now - (now % window_seconds)`
([`:40`](../backend/src/services/request_rate_limit.py)) — so the budget resets
on wall-clock boundaries, not per user.

**Live verification (pending):** confirm `CF-Connecting-IP` survives the Pages
service binding by issuing 11 logins from one IP and checking that the 11th
returns `429`. If it does not, the limiter is keying on `'unknown'` for every
request, which is a different and more severe problem — one global bucket for
all users.

**Fixed** — `auth_login` is now keyed on the submitted identifier and charges
only genuine failed attempts. See [Fixes](#2-the-login-rate-limiter-stopped-punishing-bystanders).
The table above describes the pre-fix behaviour and is kept as the record of
what was found.

---

## Phase B — baseline

_Not run. Record here: single-VU per-endpoint p50, and a single cold login
timing (PBKDF2 at 310,000 iterations inside Pyodide,
[`authentication.py:15`](../backend/src/services/authentication.py))._

## Phase C — 20 concurrent users

_Not run. Record here: raw k6 summary, per-endpoint p50/p95/p99, every 5xx with
the matching `wrangler tail` output, and whether the canary browser stayed
usable._

Expected pressure points, from reading the code:

- `/api/me/progress` issues ~7 sequential D1 queries
  ([`progress.py`](../backend/src/services/progress.py)); the catalog service
  ~19. Latency is additive per request and D1 has one primary region.
- Authenticated endpoints carry no `Cache-Control`, so unlike the public catalog
  they reach the Worker on every request.
- Pyodide init on cold isolates is the suspected source of the previously
  observed production 500s, and Phase 0 measured a 12.7 s cold catalog request
  against 3.3 s warm — consistent with an expensive init on the cold path.

## Phase D — login burst

_Formal burst not run yet. But the failure it was meant to look for already
reproduced during session minting, without any concurrency._

### The 503 reproduced on sequential logins

While minting sessions one at a time, login 9 returned:

```
HTTP 503 | Worker exceeded resource limits | ray=a275225218a7dc82-FRA
```

This is Cloudflare killing the Worker for exceeding its resource budget, not an
application exception — the response is a Cloudflare HTML interstitial, so
clients get no JSON error body.

Three properties worth recording:

- **No concurrency was involved.** The requests were strictly sequential.
- **It is intermittent.** The immediate retry succeeded. So it depends on
  isolate state or load, not on the request itself.
- **Retries consume rate-limit budget.** 9 logins plus 1 retry hit the
  10-per-15-minute ceiling, which makes the Phase A shared-IP problem worse
  than the raw policy numbers suggest.

### Login costs ~0.5 s of CPU

`wrangler tail` on the *successful* logins:

| Request | wallTime | cpuTime |
| --- | --- | --- |
| login 1 | 1005 ms | 529 ms |
| login 2 | 701 ms | 538 ms |
| login 3 | 566 ms | 457 ms |
| login 4 | 523 ms | 421 ms |

That is `_hash_password` running PBKDF2-HMAC-SHA256 at
`PASSWORD_PBKDF2_ITERATIONS = 310_000`
([`authentication.py:15`](../backend/src/services/authentication.py)) inside
Pyodide. A typical Worker request costs single-digit milliseconds.

### Confirmed: there are TWO separate failure modes

`wrangler tail --status error` over the full minting run plus concurrent real
browser traffic captured 43 failing requests. They are not one bug.

| | Mode A — CPU exhaustion | Mode B — Pyodide GIL fault |
| --- | --- | --- |
| Exception | `Worker exceeded CPU time limit.` | `Attempted to use PyProxy when Python GIL not held` |
| Occurrences | 2 | 20 (+3 `code had hung`) |
| cpuTime | 421–538 ms | 0–20 ms (median 2 ms) |
| wallTime | ~500 ms | 2.2–2.8 s |
| Endpoint | `/api/auth/login` only | every endpoint |
| Trigger | PBKDF2 at 310k iterations | not load-dependent |

**Mode B is the one that matters, and it is the source of the production 500s.**
`Attempted to use PyProxy when Python GIL not held` is the known workerd
Python-Workers defect. Note the shape: median CPU of **2 ms** with a 2.5 s wall
time. These requests are not doing work and running out of budget — the Python
event loop wedges (`Exception in callback PyodideTask.task_wakeup(<PyodideFuture...>)`),
the request never completes, and Cloudflare eventually kills it and reports
`exceededCpu`. **The `exceededCpu` outcome is misleading**; it is a symptom of
the hang, not CPU pressure.

One correction to prior notes: this was believed to be specific to the Pages
service-binding path. It is not. Every observation here is on direct
`workers.dev` ingress, so moving to direct ingress does not avoid it.

Mode A is real but rare and confined to login. Fixing it means reducing
per-login CPU: lower the iteration count (weakens hashing), or move to
WebCrypto's native `crypto.subtle.deriveBits`, which needs a migration path for
existing stored hashes.

### `/api/client-errors` amplifies the failure

24 of the 43 failing requests were `POST /api/client-errors` — the frontend's
own error reporter. When the Worker starts failing, the browser reports each
failure, those reports hit the same wedged Worker and fail too. A partial outage
becomes a self-sustaining request storm against the endpoint least able to
absorb it.

### Why "too many requests" appears on login and nowhere else

Only five endpoints have any rate limit
([`request_rate_limit.py:19-23`](../backend/src/services/request_rate_limit.py)),
and each policy has its **own** counter keyed by `(scope, client_key)`:

- `/api/auth/login` — 10 / 15 min
- `/api/auth/register` — 5 / hour, a **separate bucket**, which is why
  registering still works when login is locked out
- `/api/feedback`, `/api/ai/catalog/*`, `/api/client-errors` — own buckets

Everything else — all of `/api/me/*`, the whole catalog — has **no rate limit at
all**. So "login 429s but everything else is fine" is exactly the designed
behaviour, not a fault.

The compounding effect is the part worth fixing: `enforce_rate_limit` runs
*before* authentication, so **failed attempts count**. Mode B causes 5xx, clients
retry, each retry burns login budget, and users are locked out for 15 minutes by
an outage that was never their fault. During this run, 20 logins plus 3 retries
exhausted two full windows.

---

## Fixes

### 1. Login no longer burns half a CPU budget

`_hash_password` ran PBKDF2-HMAC-SHA256 at 310,000 iterations through
`hashlib`, i.e. as interpreted Pyodide bytecode, for 421–538 ms of CPU per
login. That is Mode A on its own, and it holds the interpreter for long enough
to widen the window for Mode B.

[`backend/src/password_hashing.py`](../backend/src/password_hashing.py) now
derives the same digest with `crypto.subtle.deriveBits`, which runs natively.
`hashlib` stays as a fallback so a broken fast path degrades into slow logins
rather than failed ones.

**No hash migration is needed, and that is the load-bearing claim.** Same
algorithm, same salt, same iteration count, same 32-byte output. Verified in the
runtime rather than argued from the spec — a temporary probe route returned:

```json
{"webcryptoUsable": true, "matchesHashlib": true}
```

so a hash written by `hashlib` (including every account seeded by
`seed_load_test_users.py`) verifies unchanged under WebCrypto. A full
register → login → wrong-password → login round trip was then run against the
remote preview and returned 201 / 200 / 401 / 200.

**It also does not make Mode B worse**, which was worth checking: WebCrypto adds
an `await` to the login path, and the `await` boundary is exactly where the
upstream race lives. Twenty sequential logins one second apart, cold isolate,
each implementation forced:

| | Succeeded | Failed |
| --- | --- | --- |
| WebCrypto | 3 / 20 | 17 |
| `hashlib` (forced) | 2 / 20 | 18 |

Indistinguishable — the wedging is the upstream fault either way. Note that this
~90% failure rate is a property of `wrangler dev --remote` preview isolates, not
of production, where the app is broadly usable; use it to compare the two
columns, not as a production figure.

The CPU saving itself is inferred rather than measured post-fix: wall-clock
times here are dominated by remote D1 round-trips (median 642 ms vs 694 ms), so
confirming the drop from ~450 ms of CPU needs `wrangler tail` against a deployed
build.

### 2. The login rate limiter stopped punishing bystanders

Three changes in
[`request_rate_limit.py`](../backend/src/services/request_rate_limit.py):

- **Keyed on the account, not the client IP.** Twenty students behind one campus
  NAT are twenty different accounts, so they no longer share a budget. This is
  the shared-IP failure from Phase A, fixed.
- **Only genuine failed attempts are charged.** `enforce_failed_attempt_limit`
  reads; `record_failed_attempt` writes, and only after an `AuthenticationError`.
  A successful login costs nothing, and neither does a 5xx from a wedged
  isolate — which is what turned an outage into a 15-minute lockout.
- **Ceiling raised to 500 per 15 minutes** (registration 5 → 50 per hour), an
  explicit product call: frustrated users are the likelier harm here.

Keying on the account would normally invite a targeted lockout — burn someone
else's budget and they cannot sign in. Counting *only failures* is what removes
that: a user with the right password never touches the counter.

### 3. A partial outage no longer feeds itself

24 of the 43 captured failures were `POST /api/client-errors`, the frontend's own
reporter, failing against the same wedged Worker it was reporting on.

- [`api.ts`](../frontend/src/shared/utils/api.ts) retries `GET`/`HEAD` up to
  three times on 5xx and transport errors. The GIL fault wedges one request and
  serves the next normally, so this converts most of Mode B into latency the user
  never sees. Mutations are not retried — a `POST` that timed out may still have
  been applied.
- Only the final attempt is reported, so recovered blips generate no traffic.
- [`reportClientError.ts`](../frontend/src/shared/utils/reportClientError.ts)
  caps reports at 10 per page load and drops 401/429 entirely (every anonymous
  session check is a 401; a 429 is the limiter working).

### 4. Bumping the compatibility date: tried, reverted

The upstream issue speculates that a newer `compatibility_date` might help. It
does not — it breaks the Worker outright. At `2026-04-01`, a **cold**
`wrangler dev --remote` failed **60 out of 60** requests:

```text
PythonWorkersInternalError: Received non-dedicated snapshot but compat flag
for dedicated snapshots is enabled
    at checkSnapshotType (pyodide-internal:snapshot:560:15)
    at maybeRestoreSnapshot (pyodide-internal:snapshot:586:5)
```

That date also flips entrypoint dispatch: local `wrangler dev` then requires
`fetch` where the deployed runtime still requires `on_fetch`, so the two
environments cannot run the same code. Both findings are recorded in
[`backend/wrangler.toml`](../backend/wrangler.toml) so the experiment is not
repeated blind.

**Mode B therefore remains open upstream.** Nothing in this repo can fix a race
inside `preparePython`. What is fixed is everything the fault used to drag down
with it: the retry absorbs it, the reporter no longer amplifies it, and it no
longer locks anyone out of their account.

---

## Notes

- Runs write to the production D1. Writes are confined to the `loadtest-*`
  accounts' own semester plans; `/api/feedback` and `/api/client-errors` are
  excluded from the scenario.
- The `loadtest-*` accounts are retained after runs, like `debug-onboarding-*`.
  Exclude both from user counts.

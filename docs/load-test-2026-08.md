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
| B — baseline | Uncontended per-endpoint latency, authenticated | **Done (2026-08-07)** |
| C — 20 concurrent users | 5xx under isolate fan-out; p95 under load | **Done — run twice, see below** |
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
| Shared-IP login lockout | **Fixed** — keyed per account, ceiling raised to 500 |
| Outages consuming login budget | **Fixed** — only real failed attempts are charged |
| `/api/client-errors` storm | **Fixed** — retries absorb transients, reports capped |
| Login CPU cost (Mode A) | **Not fixed** — workerd caps PBKDF2 at 100k iterations |
| GIL fault (Mode B) | **Upstream, unfixed** — mitigated, not resolved |

### Answering the original question

**Does the app stay correct and usable at 20 concurrent users, and where does it
start to hurt?**

Correct: yes. Across both Phase C runs, every failure was the runtime killing a
hung request — no wrong answers, no data corruption, no rate-limit lockouts, no
4xx. The application logic holds.

Usable: **conditionally**. In a good window it is fine. In a bad window roughly
1 request in 20 fails outright, and the p95 sits near 3 s in both. For a
20-person lecture demo that means a handful of visible errors and a
consistently sluggish feel — not an outage.

Where it hurts is **not** where the plan predicted. Concurrency is not the
problem: the median at 20 VUs (118 ms) is *better* than at 1 VU (2620 ms),
because sustained traffic keeps isolates warm. The problem is Python Worker
cold start, which a realistically-paced single user pays on nearly every
request.

### Setup state

Accounts seeded and 20 sessions minted (`load-test/sessions.json`, gitignored,
valid 30 days). `load-test/recorded-session.json` is now generated from a real
authenticated browser session (75 logged requests, 2026-08-07), replacing the
earlier placeholder.

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

Run against the deployed Worker (version `ff27e541`) from the real recording,
1 VU, 1 iteration, 43 requests.

```
requests: 43   failed: 0.00%   server_errors: 0   rate_limited: 0   client_errors: 0
http_req_duration: med=2620ms p95=3880ms p99=6793ms max=8115ms
```

Correct, and slow. **Median latency at one user with no contention is 2.6 s.**

The interesting part is that this is *worse* than hammering the same endpoints.
Tight bursts earlier the same hour measured p50 of 138-425 ms. The difference is
think time: the scenario waits 3-8 s between steps, the isolate gets recycled in
the gap, and nearly every request pays Pyodide start-up again. Hammering keeps
the isolate warm and hides exactly the cost a real user pays. **Realistic pacing
is the pessimal case, not the optimistic one.**

## Phase C — 20 concurrent users

Run twice, back to back, same script and same deployed version. The two runs
disagree, and that disagreement is the finding.

| | Run 1 (15:12) | Run 2 (15:20) |
| --- | --- | --- |
| Requests | 1158 | 1154 |
| Failed | **0.00 %** | **4.85 %** |
| `server_errors` (5xx) | **0** | **56** |
| `rate_limited` (429) | 0 | 0 |
| `client_errors` (4xx) | 0 | 0 |
| med / p95 / p99 / max | 122 / 3054 / 5993 / 27633 ms | 118 / 3073 / 6350 / 9011 ms |

Nothing changed between them. The fault is **episodic**: it is not provoked
reliably by concurrency, and it is not absent either.

> Correction to an assessment made earlier the same day, before Run 2 existed.
> On the strength of 380 clean probe requests and Run 1, this report said the
> fault "is not load-triggered at our scale — 20 concurrent users don't provoke
> it". Run 2 refutes that. Twenty concurrent users *can* provoke it; the
> evidence for the negative claim was a run that happened to land in a good
> window. One clean run proves nothing about an intermittent fault.

### What the 56 failures were

`wrangler tail --status error` captured **exactly 56 events**, matching k6's
count one for one.

| Outcome | Count | Exception |
| --- | --- | --- |
| `exception` | 54 | "The Workers runtime canceled this request because it detected that your Worker's code had hung" |
| `exceededCpu` | 2 | "Worker exceeded CPU time limit." |

Median `cpuTime` **1 ms**, median `wallTime` **2 ms**. These requests did no
work before the runtime killed them, which is the same signature recorded in
Phase D: the Python event loop wedges and the request never completes. The
`exceededCpu` outcome on the other two is misleading in the same way — 125 ms of
CPU is not a CPU-limit breach.

Note that the literal strings `GIL` and `PyProxy` appear **zero** times in this
capture. The behavioural fingerprint matches cloudflare/workerd#6624 but the
underlying message did not surface this time, so attribution rests on the
signature rather than on the exception text.

Failures were spread across **9 different endpoints** — heaviest on
`/api/me/semester-plans/SS%202026` (31), which is simply the most-requested path
in the scenario. Nothing endpoint-specific.

### Per-endpoint latency (Run 2)

```
endpoint                                    med       p95       p99       max
/api/catalog/courses                      925ms    5727ms    7874ms    8884ms
/api/me/semester-plans/SS 2026/balance    145ms    3528ms    7535ms    8537ms
/api/me/profile                           206ms    3252ms    8094ms    8465ms
/api/me/favorites                         179ms    2900ms    4104ms    5962ms
/api/me/semester-plans/SS 2026            103ms    2894ms    7382ms    9011ms
/api/me/completed-courses                 124ms    2881ms    3515ms    3673ms
/api/catalog/courses/1115                 402ms    2878ms    2922ms    2933ms
/api/me/transcript-issues                 100ms    2813ms    2985ms    3028ms
/api/regulation-versions/MSC_INFO_2021     73ms    2774ms    4145ms    5987ms
/api/me/progress                          250ms    2746ms    2945ms    2995ms
/api/config                                61ms    2695ms    2870ms    2914ms
/api/me/semester-plans/WS 2026/27          94ms    2633ms    5979ms    6899ms
/api/study-programs                        50ms    2593ms    2720ms    2752ms
/api/auth/session                          61ms    2530ms    3718ms    4015ms
/api/me/semester-plans                    110ms    2369ms    3077ms    3253ms
/api/catalog/periods                       56ms    2326ms    2426ms    2451ms
```

**Read the two columns separately — they are different phenomena.**

- **Medians track real work.** `/api/config` returns one null field in 61 ms.
  `/api/catalog/courses` ships 1.43 MB in 925 ms. `/api/me/progress` and its ~7
  sequential D1 queries land at 250 ms. All defensible.
- **p95 is a flat ~2.3-2.9 s on every endpoint regardless of what it does.**
  `/api/catalog/periods`, which returns a short list, has a p95 of 2326 ms —
  within 25 % of `/api/me/profile`. A cost that is identical across endpoints
  doing wildly different amounts of work is not per-endpoint work. It is a fixed
  entry cost: Pyodide start-up.

The consequence for optimisation is direct: **tuning individual endpoints cannot
fix the tail.** Collapsing `/api/me/progress`'s 7 queries into 1 would move its
250 ms median, not its 2746 ms p95. Only reducing cold starts — fewer Python
isolate initialisations, or moving hot paths off Python — touches the p95.

The one endpoint worth optimising on its own merits is
`/api/catalog/courses`: a 925 ms median and 5727 ms p95 for a 1.43 MB payload is
real work, and it is the single most expensive thing in a session start.

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

### 1. Login CPU — attempted, blocked by a runtime cap

**This one is not fixed.** Recorded in full because the blocker is undocumented
and cost real time to find.

`_hash_password` runs PBKDF2-HMAC-SHA256 at 310,000 iterations through
`hashlib`, costing 421–538 ms of CPU per login. `/api/auth/login` is the only
endpoint observed failing with "Worker exceeded CPU time limit" (Mode A).

Moving it to `crypto.subtle.deriveBits` does not work. workerd refuses it:

```text
NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
supported (requested 310000).
```

The limit appears nowhere in the Workers Web Crypto documentation. It was found
by timing the two implementations inside the Worker at the *real* iteration
count — an earlier probe used 1,000 iterations, which is under the cap and so
passed, proving only that the FFI plumbing works.

[`password_hashing.py`](../backend/src/password_hashing.py) therefore keeps the
WebCrypto path but gates it on `WEBCRYPTO_MAX_PBKDF2_ITERATIONS`, so it is
explicitly dormant rather than throwing once per isolate. Behaviour today is
unchanged: every login still goes through `hashlib`.

#### How much was on the table anyway

Less than it first looked. The same 310,000 iterations, measured:

| Implementation | Time |
| --- | --- |
| Native OpenSSL (`hashlib`, CPython on the dev machine) | 313 ms |
| Pyodide `hashlib` in the Worker | 421–538 ms |
| Pure-Python PBKDF2 loop (extrapolated) | ~4,300 ms |

Pyodide's `hashlib` is **compiled C running in WASM at roughly 1.5× native**,
not interpreted bytecode — the pure-Python figure is 10× further away. So native
WebCrypto was worth something like a third, not an order of magnitude. PBKDF2 is
expensive by design; no implementation makes 310,000 iterations cheap.

#### What it would take

Dropping to ≤100,000 iterations. That is a **security decision, not a
performance one** — it weakens the hash against offline attack by 3×, and
310,000 is already below OWASP's current PBKDF2-SHA256 guidance. It also needs a
per-user iteration count plus rehash-on-successful-login, because existing
hashes cannot be recomputed without the plaintext.

Weighed against the benefit, this looks like a poor trade: Mode A was **2 of 43**
observed failures, against 20+ for the GIL fault. Recommend leaving the
iteration count alone unless CPU-limit failures become common.

#### What was verified

- The two implementations agree byte for byte below the cap
  (`{"webcryptoUsable": true, "matchesHashlib": true}`), so a future switch
  would be a change of executor, not a hash migration.
- The gated code does not make Mode B worse. This was worth checking, since
  WebCrypto adds an `await` to the login path and the `await` boundary is where
  the upstream race lives. Twenty sequential logins one second apart on a cold
  isolate, each implementation forced:

  | | Succeeded | Failed |
  | --- | --- | --- |
  | WebCrypto | 3 / 20 | 17 |
  | `hashlib` (forced) | 2 / 20 | 18 |

  Indistinguishable. That ~90% failure rate is a property of
  `wrangler dev --remote` preview isolates, not of production where the app is
  broadly usable — compare the two columns, do not read it as a production
  figure.
- Register → login → wrong password → login against the remote preview returned
  201 / 200 / 401 / 200.

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

## Harness corrections found by the Phase B gate

The "1 VU must pass before any multi-VU run" gate earned its place — the first
Phase B run failed, and all three failures were rig bugs, not app faults. A
20-VU run started blind would have reported them as findings.

| Bug | Symptom | Fix |
| --- | --- | --- |
| `buildWriteBody` sent one body shape for every write | `POST /api/me/completed-courses/import` and `PUT /api/me/transcript-issues` both 400 | Excluded both writes in `build-scenario.mjs`; exclusions are now method-aware so the legitimate `GET /api/me/transcript-issues` survives |
| Only 5xx was logged | Three 4xx were invisible; the run failed a threshold with no indication why | Log every unexpected status; added a `client_errors_4xx` counter and threshold |
| `formatLatency` guarded on `values.p95` | Every run printed `http_req_duration: n/a` while the numbers were present under `values['p(95)']` | Corrected the key; added `summaryTrendStats` so p(99) is collected at all |
| Tagged sub-metrics never materialised | Per-endpoint p50/p95/p99 was collected and silently dropped | k6 only emits a tagged sub-metric when a threshold references it, so `scenario.js` now generates one permissive threshold per recorded endpoint |

A fourth failure was not a bug: `GET /api/me/semester-plans/WS%202026%2F27`
returns 404 because the recording came from an account that had that plan and
the `loadtest-*` accounts do not. Whether a saved plan exists is per-account
state, not app health, so semester-plan reads now treat 404 as expected via a
per-request `responseCallback` — which keeps it out of `http_req_failed` instead
of quietly inflating it.

## Notes

- Runs write to the production D1. Writes are confined to the `loadtest-*`
  accounts' own semester plans; `/api/feedback` and `/api/client-errors` are
  excluded from the scenario.
- The `loadtest-*` accounts are retained after runs, like `debug-onboarding-*`.
  Exclude both from user counts.

# Load test: ~20 concurrent users (August 2026)

> **HANDOFF — read this first.** The sections below are a chronological record and
> contain claims that were later retracted. This block is the current state.

## Where the investigation stands (2026-08-08, second session)

**Goal:** find and fix the cause of production 5xx so the app is dependable for
multiple concurrent users.

**Answer to the original question.** Twenty concurrent users walking a realistic
catalog session — including the two most expensive requests in the app — now
complete 400/400 requests with no user affected. Before the fixes, the first-load
request alone destroyed a backend isolate every five calls. The authenticated
half of a session could not be included, because staging cannot validate
production-minted sessions; those endpoints were measured individually instead
and are all at or under ~20 ms.

**Headline:** the fault is **CPU**, not payload size, concurrency, or memory. An
isolate that does sustained CPU-heavy work is killed with `exceededCpu` (HTTP
1102) and is then *permanently* dead — every later request routed to it returns
1101 `code had hung` with 0–2 ms CPU. The app's dominant CPU cost was handing
JSON response bodies to the runtime as Python `str`, which Pyodide converts at
the JS boundary at roughly **112 ms of CPU per MB**.

### Established, with measurements

| Finding | Evidence |
| --- | --- |
| Sequential requests pin to one isolate; the **first concurrent batch forks** to a second, then sticks | 30/30 one isolate sequentially; batch 0 split 1/5, batches 1–4 all on the new one |
| Returning a body as `str` costs ~112 ms CPU per MB | 2 MB probe: 193 ms as `str` |
| Returning the **same bytes pre-encoded** is ~4x cheaper | same probe: 44 ms (`.encode()` first); real catalog 98.6 ms -> 67.7 ms |
| Building the payload is cheap; **sending** it is the cost | 4 MB built and discarded: 33 ms, survived 60 rounds. 4 MB sent: ~480 ms, dead in 5 |
| The kill is `exceededCpu` / 1102, and the victim signature is different | causing request: `exceededCpu`; every later request on that isolate: `code had hung`, cpu 0–2 ms |
| **A response body is not required at all** | pure arithmetic at 136 ms/req died at round 10 (1906 ms cumulative) |
| The 2020 ms an infinite loop burns is not a per-request cap but the **whole isolate allowance**, spent at once | see "The rule" below |
| Idle time does **not** restore capacity | gap 0 ms -> died round 10; gap 5000 ms -> died rounds 7 and 11; gap 3000 ms -> round 12 |
| A dead isolate poisons its connection permanently | after the kill, even 1 KB requests fail forever on that connection |

Deaths looked like they clustered near ~1.9–2.4 s of *cumulative* CPU whenever
per-request CPU was high — which turned out to be a coincidence of these
workloads, not the rule. See "The rule (resolved)" below; the real invariant is
the overage above 10 ms per request.

| workload | CPU/request | died at round | cumulative CPU |
| --- | --- | --- | --- |
| probe 4000 KB `str` | ~480 ms | 5 | ~2400 ms |
| probe 2000 KB `str` | 193 ms | 10–11 | 2123 ms |
| pure CPU spin, no body | 136 ms | 10 | 1906 ms |
| real catalog, `str` | 98.6 ms | 23 | 2268 ms |
| real catalog, pre-encoded | 67.7 ms | 33 | 2234 ms |

Low-CPU workloads exceed that same cumulative figure and survive, which is what
ruled the cumulative reading out:

| workload | CPU/request | outcome |
| --- | --- | --- |
| `/health` | 2.9 ms | 1400 requests, one isolate, **3603 ms**, no failure |
| probe 2000 KB pre-encoded | 44 ms | 120 rounds, **249 MB**, ~5.3 s, no failure |

### Falsified this session — do not rebuild on these

- **"The fault is concurrent response bytes within one isolate."** A single
  sequential stream kills an isolate just as well (batch=1, 4 MB, dead in 5), and
  pure CPU with no body kills it too.
- **"It needs concurrency and size."** Neither is required.
- **Isolate memory / total resident bytes.** Ballast of 0/16/32/64 MB moved the
  threshold not at all (7.0 MB concurrent in every condition, heap verified at
  49.9/59.9/103.5 MB). Separately an isolate tolerated **179 MB** of resident
  ballast before dying.
- **A fixed per-isolate lifetime CPU budget.** Predicted death at round ~690 for
  `/health`; it survived 1400 rounds and 3603 ms.
- **Cumulative bytes sent.** Pre-encoded mode served 249 MB and survived, while
  `str` mode died at 21.5 MB.
- **A CPU rate / duty-cycle limit.** A 4 % duty cycle died as fast as 92 %.
- **"Probe thresholds don't transfer / the real app is ~4x more fragile."** The
  earlier probe numbers were measured with a broken protocol — see below.

### The rule (resolved)

**This account is on the Workers _Free_ plan, where the documented CPU limit is
10 ms per invocation**, with "built-in flexibility to allow for cases where your
Worker infrequently runs over the configured limit" and termination on
"consistent overages"
([limits](https://developers.cloudflare.com/workers/platform/limits/)).

Measured, that flexibility is a fixed allowance:

> An isolate is terminated once **`Σ max(0, cpu_per_request − 10 ms)` reaches
> ≈ 2000 ms**. It is then permanently dead.

The allowance is spendable either way, which is why one number explains both
shapes of failure:

| how it was spent | debt at death |
| --- | --- |
| one runaway request (accidental infinite loop) | **2020 ms** |
| catalog `str`, 98.6 ms x 23 | 2038 ms |
| catalog pre-encoded, 67.7 ms x 33 | 1904 ms |
| probe 2000 KB `str`, 193 ms x 10.5 | 1921 ms |
| probe 1000 KB `str`, 66 ms x 35 | 1960 ms |
| catalog `limit=50`, 44.9 ms x 55, **verified-fresh isolate** | **1917 ms** |

The decisive pair, both on verified-fresh isolates (`x-isolate-seq` = 2):

| run | CPU/request | total CPU | outcome |
| --- | --- | --- | --- |
| catalog `limit=5` | **10.1 ms** | **3032 ms** | survived 300 requests |
| catalog `limit=50` | 44.9 ms | 2467 ms | **dead at 55** |

Less total CPU killed it. **Per-request CPU is the only thing that matters;
cumulative CPU is irrelevant.** Work split into requests that each stay under
10 ms accrues *zero* debt and runs indefinitely — which is why `/health`
(2.9 ms) survived 1400 requests and 3603 ms.

### Which endpoints actually accrue debt

Measured by death rate on **verified-fresh** isolates, which doubles as a CPU
meter: `cpu ≈ 10 ms + 2000/rounds_to_death`. No `wrangler tail` needed, and it is
cheapest for exactly the endpoints that are dangerous.

| endpoint | CPU/request | isolate dies after |
| --- | --- | --- |
| `/api/catalog/courses?limit=1000&period=all` (**first load**) | **~350–500 ms** | **5, 7, 6 requests** (three runs) |
| `/api/catalog/courses?limit=500&period=229` | 67.7 ms | 33 requests |
| `/api/catalog/courses?limit=50` | 44.9 ms | 55 requests |
| `/api/catalog/courses?limit=5` | 10.1 ms | survived 300 |
| `/api/catalog/periods` (warm) | 2.8 ms | survived 700 |
| `/health` | 2.9 ms | survived 1400 |

**This is the operational headline.** Every user's first page load fetches the
whole 1.43 MB catalog, which costs ~50x the free-plan per-request CPU limit, so
roughly **every fifth first-load destroys a backend isolate** — permanently. That
is the whole "20 concurrent users" fragility in one line, and it is unrelated to
concurrency.

Note `/api/catalog/periods` measured 58 ms on its *first* request and 2.8 ms warm:
single-shot samples measure cold-start cost, so warm medians are required.

### What this means for the fix

Anything above 10 ms of CPU per request kills an isolate eventually; the CPU cost
only sets how fast. Encoding the body (98.6 -> 67.7 ms) slowed the bleed by ~35 %
and extended isolate life from 23 to 33 requests — necessary, **not sufficient**.
A 10-user cohort still saw 17.3 % failures with it applied.

Two ways out, and they are not equivalent:

1. **Move the account to Workers Paid.** The per-invocation limit goes from 10 ms
   to 30 s (5 min max), which removes this entire failure class with no code
   change. Getting a 131-course catalog response under 10 ms of CPU in Pyodide is
   likely infeasible, so this is the robust answer.
2. **Keep every response under 10 ms of CPU.** Real, because debt is per-request:
   the same work split into sub-10 ms responses costs nothing. Needs both the
   lecturer projection (drop `_build_catalog_summary`, ~0.83 ms/course) *and*
   pagination — a projection alone lands near ~25 ms, still over the line.

### The fix, measured end to end

`/api/catalog/courses` now caches the **encoded** response bytes per isolate
(`services/catalog_response_cache.py`), keyed on limit, period and normalised
search term. Searches are cached because a broad two-character prefix against the
whole catalog costs ~230 ms and those prefixes are what users type first; the
cache is bounded by **bytes** (16 MB) rather than entry count, since one entry can
be 1.5 MB and another 20 KB. Almost all of the endpoint's CPU was rebuilding an identical answer —
D1 round-trips plus `_build_catalog_summary` per course — for a catalog that only
changes on re-import.

| measurement | before | after |
| --- | --- | --- |
| `period=all`, requests until a fresh isolate dies | **5, 7, 6** | **survived 120**; one isolate served 240+ |
| implied CPU per request | ~350–500 ms | **≤18 ms** |
| 10-user cohort on `period=all`, 30 requests each | — | **300/300 ok, 0 users affected** |
| broad search `q=in&period=all` (worst case a user can type) | dies at 10 | **survived 100** |
| **20 concurrent users**, 20-request session across four catalog endpoints | — | **400/400 ok, 0/20 users affected** |

For comparison, the same cohort shape against the *lighter* `period=229`
endpoint, with only the encoding fix applied, failed 17.3 % across 7 of 10 users.

Correctness was checked rather than assumed: responses are byte-identical across
repeats (same SHA-256), and 24 interleaved requests across four different
limit/period keys all returned the right course counts, so keys do not collide.

> One unexplained observation: during the first check a single
> `limit=500&period=229` response came back with 2304 courses instead of 131. It
> did not reproduce in 28 subsequent requests, production returns 131, and the
> interleaving test is clean. Most likely a stale isolate serving one of the many
> builds staging hosted that day, but it is recorded here because it was not
> positively explained.

### What is still over the line

The cache only helps the public catalog. Per-user endpoints cannot be cached this
way — the data is user-specific and changes on edit, so stale answers would be a
correctness bug. Measured on **production** (staging cannot validate
production-minted sessions: the two Workers have different `AUTH_TOKEN_SECRET`s,
which is why `/api/me/*` returns 401 there while the public catalog still
answers).

**Warm** costs, measured over one reused connection so every sample lands on the
same isolate:

| endpoint | cold | warm | debt/request |
| --- | --- | --- | --- |
| `/api/me/progress` | 68 ms | **14–20 ms** | ~5 ms |
| `/api/me/favorites` | 5 ms | **4–8 ms** | none |
| `/api/me/semester-plans` | — | 9 ms | none |
| catalog, cached | — | ≤18 ms | ~8 ms |

> **Correction.** An earlier pass reported 81 ms and 57 ms for progress and
> favorites and concluded they were the dominant remaining cost. That was wrong:
> those samples were taken with separate `curl` invocations, so each opened its
> own connection and could land on a different *cold* isolate. The same confound
> was already known for `/api/catalog/periods` (58 ms cold, 2.8 ms warm) and was
> simply not applied. Always measure over one reused connection.

So a user's first page load now costs roughly **13 ms of debt** (catalog 8 +
progress 5), not the ~160 ms previously stated — an isolate tolerates on the order
of a hundred first loads rather than a dozen. With the catalog cached there is no
longer an endpoint that obviously has to be optimised next.

What remains is **cold start**: a new isolate pays 60–70 ms on its first real
request, and ~400 ms if that request is the first uncached catalog build. That is
a per-isolate cost, not a per-user one, and it is the reason single-shot
measurements mislead.

### Contamination control (important)

A dead isolate can outlive a deploy, and a live one carries whatever debt earlier
traffic left on it, so "requests until death" is meaningless without knowing the
isolate started fresh. `cumulative` now prints the serving isolate's
`x-isolate-seq` and flags a non-fresh start. The one badly-fitting data point in
the table above (500 KB `str` appearing to die at only ~600 ms of debt) is
believed to be exactly this.

### Traps that invalidated real work here

1. **A health gate must abort, not warn** — now enforced by `health-gate.mjs`.
   Beware `gate | tail`: the pipe masks the exit code and `&&` will not stop.
2. **Priming an isolate then measuring on a batch measures a different isolate**,
   because the first concurrent batch forks. Re-assert per-isolate state on
   *every* request and verify it in the response headers. This invalidated the
   first ballast run, which returned a meaningless flat result.
3. **After a deploy, stale isolates briefly serve the old code**, and a deploy is
   only a partial reset. Verify the version before measuring.
4. **`time.monotonic()` never advances inside a Worker** — time is frozen between
   I/O as a timing-attack mitigation, so a clock-bounded loop runs forever.
5. **Git Bash rewrites `--path /health`** into a Windows path. Use
   `MSYS_NO_PATHCONV=1`.

### Next steps

1. **Decide on Workers Paid.** It is the only option that removes the failure
   class outright, and it is a billing decision rather than an engineering one.
2. **Stop fetching `period=all` on first load** — highest-impact single change,
   and it is a frontend one. Then projection **and** pagination for the catalog,
   targeting <10 ms CPU per response. Verify with `cumulative` on a fresh isolate — the
   pass condition is that mean CPU/request stays under 10 ms, not that a given
   run survives.
3. Deploy the `json_response` fix to production (verified on staging only).
4. Concurrency is **not** the trigger, so `mapWithConcurrency`'s limit is not
   load-bearing; do not tighten it to 1 on the old reasoning.

### Tools

- `load-test/health-gate.mjs` — aborting preflight; exits non-zero.
- `load-test/isolate-probe.mjs` — one HTTP/2 session = one isolate. Commands:
  `heap`, `isolate-map`, `ramp-ballast`, `threshold`, `ballast-effect`, `shape`,
  `single-shot`, `cumulative`, `autopsy`. Supports `--auth 1` (reuses
  `sessions.json`) and `--path` so it can drive the real backend.
- `load-test/payload-probe/` — Python Worker: `/?kb=N&mode=build|cached|bytes`,
  `&discard=1`, `&ballast_mb=N`, `&spin_k=N`, `/heap`. Deploy over staging
  (`studyplaner-api`); restore with `wrangler deploy --name studyplaner-api` from
  `backend/`.
- Correlate with `npx wrangler tail studyplaner-api --format json` — `cpuTime`
  and `outcome` are what actually distinguish the failure modes.
- `x-isolate-id` / `x-probe-*` response headers.

### Caveat on production data

Heavy load was run against production on 2026-08-07/08 and it entered the
degraded state several times. Today's `client_error_log` is contaminated with
test traffic and must not be read as user impact.

---


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

Usable: **yes, in steady state.** Settled, the app runs at a 92 ms median and a
298 ms p95 under 20 concurrent users, with no failures. That is a healthy
service.

Two things spoil it, and neither is concurrency:

1. **Deploy recency.** Minutes after a deploy the same test reports a 2620 ms
   median at a single user. Whether the deploy causes it and how long it lasts
   is not yet established — see the correction above and the open questions
   below.
2. **The episodic hang.** One run in three produced 56 failures, of which 21
   were unretryable mutations. During such a window a typical user hits about
   one hard error per session.

The plan was built on the premise that 20 concurrent users was the risk. It is
not: 20 VUs performs *better* than 1 VU in every run, because sustained traffic
keeps isolates warm. Neither of the two real problems is load-related at all.

### Open questions

- **Does deploying cause the slow window, and how long does it last?** Redeploy
  the same code, then re-run Phase B at intervals (immediately, +5 min, +30 min,
  +2 h). Two paired observations show association only.
- **How often does a bad window happen?** Three runs, one bad. Repeat Phase C
  5-10 times across a day and record `user_visible_failures` each time.
- **Do retries actually absorb the GET failures?** The absorption metric exists
  now but has only run in clean windows. It needs a bad one to mean anything.

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

## Correction: the latency numbers below were measured minutes after a deploy

**Everything in Phases B and C was run 6-20 minutes after `wrangler deploy`.**
Re-running the identical scripts ~20 hours later, against the same Worker
version and the same accounts, gives completely different latency:

| Measurement | 2026-08-07, ~15 min post-deploy | 2026-08-08, settled |
| --- | --- | --- |
| Phase B (1 VU) median | 2620 ms | **105 ms** |
| Phase B (1 VU) p95 | 3880 ms | **338 ms** |
| Phase C (20 VU) median | 118 ms | 92 ms |
| Phase C (20 VU) p95 | 3073 ms | **298 ms** |
| Phase C (20 VU) p99 | 6350 ms | 2128 ms |

A 25x change at 1 VU with no code change. Two conclusions drawn on 2026-08-07
do not survive this and are withdrawn:

- **"p95 is a flat ~2.5 s on every endpoint, therefore Pyodide start-up is a
  chronic per-request cost."** In steady state p95 is ~300 ms. The flat ~2.5 s
  was real but is not the normal operating state.
- **"A realistically-paced single user is the pessimal case, because think time
  lets the isolate go cold between steps."** The 1 VU run uses the same 3-8 s
  think times and now medians at 105 ms. Think time is not the driver.

What both readings actually had in common was deploy recency, which was not
controlled for and not even considered. The per-endpoint table further down is
therefore a table of *post-deploy* latency; keep it for that, do not read it as
normal behaviour.

### What was actually going on: warm-isolate availability

The `x-isolate-seq` marker settles this. It reports how many responses an isolate
had served when it answered, so its distribution measures isolate reuse directly.

| Condition | Isolate reuse | Latency |
| --- | --- | --- |
| 20 VUs, sustained | med **53** responses per isolate, max 187 | med 102 ms, p95 266 ms |
| 5 sequential curls, no other traffic | **4 distinct isolates for 5 requests** | — |
| 1 VU, minutes after a deploy | (not instrumented yet) | med 2620 ms |
| 1 VU, straight after a Phase C run | (not instrumented yet) | med 105 ms |

The variable is not concurrency, and not think time. It is **whether a warm
isolate happens to exist when the request arrives**, which depends on recent
traffic volume to that colo:

- Under sustained load an isolate amortises its start-up over ~53 requests, so
  almost nobody pays it.
- With no recent traffic nearly every request gets a fresh isolate and pays the
  full cost.
- **A deploy destroys every warm isolate at once**, which is why the post-deploy
  numbers looked like a chronic problem.

This also explains the 1 VU result that made no sense: yesterday's ran minutes
after a deploy (nothing warm, 2620 ms); today's ran immediately after a Phase C
run had warmed the colo (105 ms). Same script, same think times, opposite result.

**Consequence for a real deployment.** A study planner used by a handful of
students at a time sits in the low-traffic regime most of the day, which is the
*expensive* one. The 92 ms median measured under 20 VUs is not what a lone user
at 9 pm experiences. Load testing flattered the app here, and the quiet case is
the one worth optimising.

**Still not established:** how long the post-deploy window lasts. That needs a
redeploy followed by measurement at intervals — see "Open questions".

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

| | Run 1 (08-07 15:12) | Run 2 (08-07 15:20) | Run 3 (08-08, settled) |
| --- | --- | --- | --- |
| Requests | 1158 | 1154 | 1247 |
| Failed | **0.00 %** | **4.85 %** | **0.00 %** |
| `server_errors` (5xx) | **0** | **56** | **0** |
| `rate_limited` (429) | 0 | 0 | 0 |
| `client_errors` (4xx) | 0 | 0 | 0 |
| `user_visible_failures` | not measured | not measured | **0** |
| med / p95 / p99 / max | 122 / 3054 / 5993 / 27633 ms | 118 / 3073 / 6350 / 9011 ms | 92 / 298 / 2128 / 4310 ms |

Nothing changed between runs 1 and 2. The fault is **episodic**: it is not
provoked reliably by concurrency, and it is not absent either. Three runs give
one bad window out of three, which is still far too small a sample to quote a
rate from.

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

### How many of those 56 would a user actually have seen?

The frontend retries safe methods up to three times
([`api.ts`](../frontend/src/shared/utils/api.ts)), so a wedged request becomes
latency rather than an error — but **mutations are never retried**, because a
`POST` that timed out may still have been applied. Splitting Run 2's 56 captured
failures by method:

| Method | Count | Retried? |
| --- | --- | --- |
| GET | 35 | yes — absorbed unless all 3 attempts fail |
| PUT | 16 | **no** |
| PATCH | 4 | **no** |
| POST | 1 | **no** |

So **21 of 56 (37 %) were user-visible immediately**, with no retry possible.
That is the number that matters: a failed `PUT /api/me/semester-plans/...` means
the student's edit did not save, and they are shown an error without knowing
whether it applied.

Spread over a 5-minute run with 20 VUs, 21 unretryable failures works out to
roughly **one hard error per user per session** during a bad window.

The 35 GETs are probably almost all absorbed — three consecutive failures is
unlikely if failures are independent — but *independence is an assumption*,
stated in a code comment ("hangs that one request and then serves the next one
normally") and not measured. If a wedged isolate keeps serving the same client,
retries land on it again and the absorption rate collapses.

`scenario.js` now measures this directly rather than inferring it: it mirrors the
frontend's retry policy and reports `absorbed_by_retry` alongside
`user_visible_failures`. Run 3 recorded 0 and 0 — a clean window, so the
instrumentation is unproven against real failures and needs a bad window to
validate.

### Per-endpoint latency (Run 2 — post-deploy, see the correction above)

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

## Established: concurrent response bytes inside one isolate

This supersedes the earlier payload conclusion and the retraction below. Every
run here starts from a deploy plus a verified-clean health check.

### It is not aggregate load — it is load per isolate

Total in-flight requests fixed at 40, payload fixed at 900 KB, volume fixed at
~900 requests. Only the distribution across connections (and therefore isolates,
which connections pin to) varies:

| config | connections | requests in flight per isolate | hung |
| --- | --- | --- | --- |
| 40 VUs x batch 1 | 40 | 1 | **4.85 %** |
| 5 VUs x batch 8 | 5 | 8 | **75.76 %** |
| 1 VU x batch 40 | 1 | 40 | **94.43 %** |

**19x more failures for identical total load**, purely by concentrating it into
fewer isolates.

### It needs concurrency *and* size, and the product is what matters

| batch | payload | concurrent bytes per isolate | hung |
| --- | --- | --- | --- |
| 40 | 2 KB | 80 KB | 0.00 % |
| 40 | 100 KB | 4.0 MB | 0.00 % |
| 8 | 300 KB | 2.4 MB | 0.00 % |
| 8 | 500 KB | 4.0 MB | 0.00 % |
| 8 | 700 KB | 5.6 MB | **56.25 %** |
| 8 | 900 KB | 7.2 MB | **78.47 %** |
| 40 | 900 KB | 36 MB | **94.43 %** |

Concurrency alone is harmless (40 concurrent requests at 2 KB: zero failures).
Size alone is harmless (900 KB spread one-per-isolate: 4.85 %). **The threshold
sits between 4.0 MB and 5.6 MB of concurrent response bytes within a single
isolate**, and it is sharp — 4.0 MB is clean twice, 5.6 MB fails 56 %.

That is consistent with a memory ceiling: Pyodide occupies most of the isolate's
budget, and the remaining headroom is a few MB.

### The production trigger, in our code

[`useHistoricalLecturerLookup.ts:55`](../frontend/src/features/courses/hooks/useHistoricalLecturerLookup.ts)
fires one full catalog fetch **per period, in parallel**:

```ts
const lookups = await Promise.all(
  periodIds.map(async (periodId) => {
    const courses = await fetchCatalogCourses('', 1000, periodId)
```

`/api/catalog/courses?limit=1000&period=<id>` returns ~1.43 MB. With 7 periods
that is **~10 MB requested concurrently**, and a browser multiplexes them over
one HTTP/2 connection, which pins to one isolate. Roughly double the measured
threshold, from a **single user opening the app**.

This matches the production failure recorded in `client_error_log` exactly: eight
requests failing in the same second, seven of them
`/api/catalog/courses?limit=1000&period=NNN` for different periods, all
`status 0`, all at ~3250 ms.

### The causal chain

1. The frontend requests N periods' catalogs in parallel, ~1.43 MB each.
2. The browser multiplexes them onto one HTTP/2 connection.
3. That connection is pinned to one Worker isolate (measured: 12 consecutive
   requests, one isolate).
4. The isolate must hold N x 1.43 MB of response bodies simultaneously.
5. Above ~4-5.6 MB the Python event loop wedges
   (`Exception in callback <_asyncio.TaskStepMethWrapper>`).
6. The isolate stays wedged, and the connection stays pinned to it, so every
   subsequent request from that user fails.
7. The damage persists; a deploy clears only ~83 % of isolates.

**Every step is measured, not inferred.** Step 5 is the only one where the
mechanism (memory) is an interpretation rather than a direct observation — what
is measured is the threshold, not its cause.

### Two corrections to the numbers above

**The per-period payload is ~530 KB, not 1.43 MB.** `limit=1000&period=229`
returns 530 KB; 1.43 MB is the `period=all` response. So seven periods is
~3.7 MB, not ~10 MB. The mechanism is unchanged but the margin is much tighter
than stated, and the "~10 MB" figure in the commit message is wrong.

**The threshold measured on the minimal probe does not transfer to the real
app.** Running the same batch probe against production's own catalog endpoint:

| batch | concurrent bytes | hung |
| --- | --- | --- |
| 2 | ~1.1 MB | **30.00 %** |
| 4 | ~2.1 MB | 62.50 % |
| 7 | ~3.7 MB | 64.29 % |

The real app hangs at **1.1 MB** where the minimal probe was clean at 4.0 MB —
roughly 4x less headroom. Plausibly because the real isolate already holds 28
modules, D1 and more resident memory, but that is an interpretation; what is
measured is the difference.

**Consequence: the concurrency limit of 2 shipped in `mapWithConcurrency` is
probably not conservative enough.** Two concurrent period fetches is ~1.1 MB,
which is exactly the configuration that hung 30 % of requests here. A limit of 1
(fully sequential), or a smaller per-period payload, is likely required. This
needs re-measuring before the fix can be called sufficient.

### Unreliable results, recorded so they are not reused

An attempt to separate payload size from D1 work returned 100 % hung with
`med=0ms max=0ms` for `/api/config` and `/api/catalog/periods` at batch=7. A zero
duration means the requests did not execute normally, and production tested
healthy both before and after. **These two measurements are not trustworthy and
no conclusion is drawn from them.**

The cause was a broken gate in the test harness: the "wait until healthy" loop
tried six times and then **proceeded regardless**, so it could not actually block
a run. Any result produced through it — including parts of the sweeps above — may
have started from a dirty state. The gate must abort, not warn.

### What this predicts, and how to check a fix

Serialising the per-period fetches, or reducing the per-period payload below
~500 KB, should eliminate the production failures. The check is
`load-test/batch-probe.js`: concurrent bytes per isolate must stay under 4 MB.

## Retraction and correction: the payload conclusion was measured on dirty state

The section below ("Root cause found") **overstates what the evidence supports**.
Follow-up experiments with a reset between runs contradict it. Read this first.

### The measurement error

Probes were run back to back without resetting the Worker, and **this fault
persists and accumulates**. Every comparison across consecutive runs was
therefore contaminated by damage from the previous run.

How bad: a payload sweep at fixed 45 VUs, run consecutively, produced

| payload | hung |
| --- | --- |
| 100 KB | 95.67 % |
| 300 KB | 95.07 % |
| 600 KB | 95.84 % |

Flat at ~95 % regardless of size, and *lower* at 900 KB (38 %) than at 100 KB.
That is not a dose-response, it is a worker that was already broken. Confirmed
directly: with **no load at all**, staging then served 5 of 6 requests as 500.

### What survives, with a reset before each run

| payload | mode | hung |
| --- | --- | --- |
| 10 KB | build | **0.00 %** (0/729) |
| 100 KB | build | 0.55 % (4/732) |
| 900 KB | build | 5.36 % (36/672) |
| 900 KB | cached | 13.43 % (92/685) |

A real dose-response with a clean zero floor — so **payload size does
contribute**. But the magnitude is ~5 %, not the ~95 % the dirty runs suggested.

**Caching the serialised body is not a fix — it is worse** (13.43 % vs 5.36 % at
the same size). Cached responses are faster, so throughput rises and more bytes
are in flight, and each isolate additionally retains ~1 MB permanently. This
falsifies the cheapest proposed fix, which was to memoise the catalog body.

### What actually dominates: progressive, persistent degradation

One deploy, then three consecutive 45 VU runs with no reset between them:

| run | requests | 5xx | user-visible |
| --- | --- | --- | --- |
| 1 | 1861 | 835 (44.9 %) | 349 |
| 2 | 2034 | 1094 (53.8 %) | 441 |
| 3 | 2577 | 2044 (79.3 %) | 823 |

It gets monotonically worse, and it does not recover on its own. This is a much
larger effect than payload size and is the thing worth explaining.

### The methodological wall

Two runs with **identical** configuration (45 VUs, 3 min, fresh deploy, health
check passed) produced 0 failures and 835 failures. The difference was what had
happened *before* the deploy.

**A deploy is a partial reset — measured, not assumed.** Sampling `x-isolate-id`
across 18 requests before a deploy and 20 after:

| | distinct isolates |
| --- | --- |
| before | 12 |
| after | 14 |
| **present in both** | **2** (`c0861e58…`, `fcc0210a…`) |

The ids are 64-bit random values generated per isolate, so these are the same
isolates, not collisions. About 17 % survived in this sample. So "deploy, see
200s, start measuring" does not guarantee a clean slate, and cross-run
comparisons relying on it are suspect — including the probe 1 / probe 2 /
probe 3 bisect below.

**But 17 % survival does not by itself explain 0 versus 835 failures** under
identical configuration. Either damaged isolates draw a disproportionate share of
traffic, or something beyond isolate carry-over is involved. That gap is
unresolved, and it is the reason no further conclusion is drawn here.

**A validated reset procedure is a prerequisite for any further conclusion.**
Candidates: wait for isolate rotation after deploy (duration unknown); verify
with a wide concurrent burst rather than sequential requests, so many isolates
are sampled; or find a way to force eviction. Until one exists and is shown to
produce repeatable clean baselines, further A/B runs will keep producing
contradictions like the one above.

## Superseded: "root cause found" — serialising a large response body in Python

Bisected on the staging Worker (`studyplaner-api`), same compatibility date and
same Pyodide build as production, 45 VUs for 5 minutes each.

| Probe | What it does | Startup | Result at 45 VUs |
| --- | --- | --- | --- |
| 1 — hello world | no imports, one `await`, `Response("ok")` | 701 ms | **2450 requests, 0 failures** |
| 2 — full import graph | imports `router` (all 28 modules), returns `"ok"` | 937 ms | **2422 requests, 0 failures** |
| 3 — large body | no imports beyond `json`, no D1, builds ~0.9 MB and serialises it | 434 ms | **hangs — 1101 and 1102 within seconds** |

Probe 3 contains no application code at all: no database, no auth, no router. It
builds a list of dicts and calls `json.dumps`. That is sufficient to reproduce
the fault.

```
[probe] 500 vu=23 body=error code: 1101
[probe] 503 vu=25 body=error code: 1102   <- Worker exceeded resource limits
```

**The trigger is constructing and serialising a large response body in Python,
under concurrency.** Everything else previously suspected is cleared:

- Not the import graph — probe 2 loads every module and is clean.
- Not Pyodide start-up in general — probe 1 is clean, and probe 3 has the
  *shortest* start-up of the three.
- Not D1 — probe 3 has no database binding.
- Not `route_request`, auth, or PBKDF2 — none of it is present in probe 3.

### Why the earlier readings pointed elsewhere

The hung requests showed 0-1 ms of CPU and emitted no `x-isolate-*` headers,
which was read as "it dies before our code runs, therefore our code is not
involved". That inference was wrong. The isolate is *already* under memory
pressure from concurrent large-payload requests, so a newly arriving request
fails at its first `await` having done no work of its own. The victim and the
cause are different requests.

This also explains why `/api/catalog/courses?limit=1000&period=all` appeared in
every sampled failing event: at 1.43 MB it is the largest thing the Worker
builds, and the scenario has each VU fetch it on first load.

### What this means

**This is fixable in this repository — no upstream dependency.** The catalog
endpoint should not materialise 1.43 MB of Python objects per request. Options,
cheapest first:

1. **Paginate** `/api/catalog/courses`, so no single response is large.
2. **Cache the serialised body** so concurrent requests share one buffer instead
   of each building their own.
3. **Precompute** the catalog JSON and serve it from R2 or the cache API,
   removing Python from the hot path entirely.

**Not yet established:** the payload size at which it becomes unsafe. Probe 3
used ~0.9 MB and broke; the threshold is somewhere below 1.43 MB and is worth
bisecting before choosing a page size.

## The capacity ceiling: 40 VUs took production down, and it stayed down

**Run 5 (2026-08-08, 40 VUs, 8 min) caused a real production outage.** This was
run against production deliberately and the consequence was not anticipated;
recording it in full because it is the most operationally significant result of
the whole exercise.

### What happened

At 12:56:19, ~8 minutes in, **every VU began failing at once** — vu=1, 3, 5, 7,
9, 11, 12, 14, 15, 16, 21, 24, 26, 27, 31, 34, 37 within a 15-second window.
This is categorically not the connection-scoped mode below; it is global.

```
[scenario] 500 GET /api/catalog/courses vu=7  iter=6  attempts=3 isolate=(none)/seq?/age? body=error code: 1101
[scenario] 500 GET /api/auth/session    vu=34 iter=12 attempts=3 isolate=(none)/seq?/age?
                                        lastHealthy=90ecae11e9bfb312/seq125/age751378
```

- **`error code: 1101`** — Cloudflare's "Worker threw an exception" page, not a
  JSON error from the app.
- **`isolate=(none)`** — no `x-isolate-*` headers, so execution never reached
  header construction. The Worker died during Python start-up.
- **`attempts=3`** — the retry policy exhausted itself against it.
- The last healthy isolates were old and productive: seq 125 at 751 s, seq 188 at
  535 s, seq 68 at 546 s. So healthy isolates were being reused heavily right up
  to the failure.

### It did not recover on its own

After the load stopped, production kept alternating almost exactly:

```
1: 200  x-isolate-id: 1d8ded6e05e6fdc9      2: 500  error code: 1101
3: 200  x-isolate-id: 221cd42aa842005a      4: 500  error code: 1101
5: 200  x-isolate-id: 6bb6bc12bf71b97b      6: 500  error code: 1101
```

**Every success carried a different isolate id** — zero reuse — and roughly every
other *isolate spawn* failed Pyodide initialisation. The Worker was not
overloaded at this point; there was no load. It was stuck in a state where new
isolates could not reliably start.

`wrangler deploy` cleared it immediately (8/8 clean afterwards). That matches the
existing operational note that production 500s are unwedged by a redeploy — and
it means **the historical production 500s users have reported are most likely
this mode**, not the connection-scoped one.

### Why this matters more than anything else in this report

- **There is a concurrency ceiling between 20 and 40 users.** 20 VUs is fine
  across four runs. 40 VUs broke it.
- **Exceeding the ceiling is not self-limiting.** It does not shed load and
  recover; it degrades and stays degraded until someone redeploys by hand.
- **This is exactly the original scenario.** The plan was written around "twenty
  students in a lecture". Twenty is fine. A full lecture hall is not, and the
  failure mode is a manual-intervention outage.

**Not yet established:** where between 20 and 40 the ceiling sits, whether it is
concurrency or total isolate count that matters, and whether the trigger is
memory. A bisect (25, 30, 35 VUs) would find it — **but not against production.**
Staging (`studyplaner-api`) runs the same build and should be used for this.

## Root cause: a connection pinned to a wedged isolate

The failure model assumed until now — "a race in isolate re-use, scattering ~5 %
of requests across all users" — is wrong. Four independent lines of evidence say
the failures are **connection-scoped**.

### 1. All 56 failures came from one TLS connection

Every captured event carries the same `cf.tlsClientRandom`
(`ynby/ue8nEu5TM5umztqHcNh3R5kk5Sz2dNWhV3ss44=`). k6 gives each VU its own
connection pool, so all 56 belong to **one VU**.

### 2. Their timing is one VU's think-time rhythm

Gaps between consecutive failures: 3137, 5194, 7592, 5322, 5623, 5987, 4826,
6219 ms ... every gap falls inside `MIN_THINK_SECONDS`-`MAX_THINK_SECONDS`
(3-8 s). Not bursts of a shared fault — one client failing on **every request it
made**, for the full five minutes.

### 3. The path mix matches exactly one VU's itinerary

Observed failures against one VU running first-load plus ~2 steady-state
iterations: favorites 8 (= 2 x 4 per iteration), profile 4 (= 2 x 2), WS 2026/27
2 (= 2 x 1). The counts line up per iteration.

### 4. Connection-to-isolate affinity is real, and now measurable

`x-isolate-id` (see [`isolate_identity.py`](../backend/src/isolate_identity.py))
makes this directly observable. Twelve requests over one keep-alive connection:

| requests | isolate | seq |
| --- | --- | --- |
| 1-10 | `ee93c89d4ea92bfc` | 3 -> 12 |
| 11-12 | `2615555fe37299fe` | 1 -> 2 |

A connection stays bound to one isolate across a long run, then rotates.

### The model, and what follows from it

A connection binds to an isolate. That isolate's Python event loop wedges
(`Exception in callback <_asyncio.TaskStepMethWrapper>` in the captured `logs`).
Every subsequent request on that connection reaches the same dead isolate, and
keeps failing until the connection rotates. Everyone else is unaffected.

- **Blast radius is different from what was reported.** Not "5 % of requests
  spread thinly" but "1 user in 20 is *completely broken* for the duration,
  19 are perfectly fine". Worse for the person affected, better for everyone else.
- **The retry mitigation probably does not work.** Retries reuse the keep-alive
  connection, so all three attempts hit the same wedged isolate. The claim that
  "35 of the 56 were absorbed by retries" is very likely false, and the fix
  direction is to force a *new connection*, not to retry on the old one.
- **Browsers are exposed the same way.** HTTP/2 keep-alive is how browsers talk
  too, so a student can have the whole app broken until a hard reload.

### Confirmed in production, independent of k6

`client_error_log` holds a matching cluster from 2026-08-07 10:20:11: **eight
different endpoints** (`/api/me/progress` plus seven catalog periods) all failing
in the same second, all `status 0` "Network request failed", all with
`duration_ms` between 3239 and 3251. Different endpoints, one instant, one
duration — a connection dying, not an endpoint failing.

Sample caveat: 25 `status 0` events over 27 days across 3 accounts, two of them
dev accounts (`test`, `test1`). Enough to confirm the shape. **Not** enough to
estimate how often real students hit it.

### Two runtime facts learned along the way

- **Module-level state is snapshotted, not per-isolate.** The first attempt
  generated the id at import and the deploy failed with `OSError: [Errno 29]
  Cannot get entropy outside of request context`. Module scope runs once, is
  captured in the Pyodide snapshot and restored into every isolate — so a
  module-scope id would be identical everywhere and identify nothing. It must be
  generated lazily on first use.
- **There is almost no isolate reuse at low traffic.** Five sequential requests
  produced four distinct isolate ids. This is worth revisiting against the
  withdrawn latency conclusion: cold start is not paid because think time lets an
  isolate go cold, but because a *fresh isolate* serves most requests.

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

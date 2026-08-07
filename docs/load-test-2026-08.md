# Load test: ~20 concurrent users (August 2026)

Report for the concurrent-user stress test. The harness and the reasoning behind
its design live in [`load-test/README.md`](../load-test/README.md).

| | |
| --- | --- |
| Target | `https://studyplaner.pages.dev` (production Pages origin) |
| Backend | Worker `studyplanner-api`, D1 `studyplanner-db` |
| Harness | k6 (standalone binary, not an npm dependency) |
| Accounts | `loadtest-01@example.com` … `loadtest-20@example.com` |

## Status

| Phase | What it establishes | Status |
| --- | --- | --- |
| A — rate-limit arithmetic | Whether 20 users behind one IP can even sign in | **Confirmed by code reading; live check pending** |
| B — baseline | Uncontended per-endpoint latency | Not run |
| C — 20 concurrent users | 5xx under isolate fan-out; p95 under load | Not run |
| D — login burst | How CPU-bound logins queue | Not run |

Phases B–D need the one-time setup in the harness README (seed accounts, record
a session, mint sessions). Until then `load-test/recorded-session.json` is a
placeholder derived from `frontend/src`, not a real recording.

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

**Fix (out of scope here, separate branch):** key `auth_login` on the submitted
identifier, or on identifier+IP, so one account's failed attempts cannot lock
out everyone sharing an egress IP.

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
- Authenticated requests bypass the Pages `caches.default` layer that serves
  anonymous `GET /api/catalog/*`
  ([`proxy.ts:65`](../frontend/functions/_shared/proxy.ts)), so every step here
  reaches the Worker.
- Pyodide init on cold isolates is the suspected source of the previously
  observed production 500s.

## Phase D — login burst

_Not run. Record here: 8 simultaneous login timings, and whether they serialise._

---

## Notes

- Runs write to the production D1. Writes are confined to the `loadtest-*`
  accounts' own semester plans; `/api/feedback` and `/api/client-errors` are
  excluded from the scenario.
- The `loadtest-*` accounts are retained after runs, like `debug-onboarding-*`.
  Exclude both from user counts.

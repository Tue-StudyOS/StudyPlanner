# Investigating API failures

The request log is available at `/log`. Every `fetchJson` attempt gets a
new `X-Request-ID`, including retries. Pages forwards the ID to the API and echoes
it in `X-Request-ID` even when an upstream fetch throws. Direct API callers can
supply the same header; otherwise the backend uses CF-Ray or a request-local ID.
These IDs are diagnostic only, never authentication or authorization inputs.

## When a failure occurs

1. Open the request log and click **Download session log before reloading**.
   Each attempt records the UTC start time, request ID, outer and upstream
   Cloudflare Ray IDs, error source, deployment version and isolate markers when
   available. HTTP 200 with invalid JSON is recorded as a failure too.
2. In Cloudflare, open **Workers & Pages → studyplanner-api → Observability**.
   Search the request ID from the download. Application failures emit one
   `server_failure` JSON event containing the exception/cause types, allow-listed safe fault summary,
   frame locations, route, isolate and actual deployed Worker version.
3. If there is no application event, search the **upstream Ray ID** and UTC time
   in the Worker invocation logs. Inspect **outcome, exceptions and CPU time**:
   runtime startup failures, hangs and resource-limit terminations can happen
   before Python can log anything. Preserve that evidence before redeploying.
4. For `Error source: gateway`, inspect Pages Functions logs for
   `gateway_exception` using the request ID, and the API's invocation logs at the
   same time. For a live reproduction:

   ```powershell
   # Backend invocation outcomes and native exceptions
   cd backend
   npx wrangler tail studyplanner-api --format json
   # In another terminal, for the relevant Pages deployment ID
   cd frontend
   npx wrangler pages deployment tail <deployment-id> --project-name studyplaner --format json
   ```

## How to interpret the evidence

- `application`: Python reached the router and returned a structured server
  failure. `database_error` and `authentication_not_configured` retain their
  exception types, frame locations and known-safe fault summaries in Cloudflare,
  not in the public response. Arbitrary exception values are deliberately omitted.
- `upstream`: the upstream returned a 5xx without an application marker. This
  includes Cloudflare runtime errors; it does not prove CPU exhaustion.
- `gateway`: the forwarding fetch threw or the gateway was not configured.
- Cloudflare `1101` means an exception; `1102` indicates a resource limit.
  Use the invocation's exception/outcome to distinguish a hang, startup fault,
  memory issue and CPU exhaustion. Do not infer the cause from HTTP 500 alone.
- On a `Gateway cache: hit`, stale isolate/version/upstream Ray markers are
  removed: no backend invocation occurred for this attempt. The request ID is
  refreshed for the current browser attempt.

## Retention and outage recovery

Backend invocation logs and application error events are explicitly enabled with
100% sampling and persistence in `backend/wrangler.toml`. Query strings are
redacted. Retention is controlled by the Cloudflare account/plan; inspect failures
promptly. Pages console logging is not a substitute for persisted backend logs.
The version metadata binding adds `X-Worker-Version` without changing the pinned
Python compatibility date, CPU limits, signing secrets, or database binding.

Browser logs remain bounded to 80 entries **in page memory**, not localStorage or
sessionStorage. Only redacted paths and metadata are retained; request bodies,
headers containing credentials, raw HTML, and transcript contents are not logged.
The download explicitly saves that sanitized session snapshot to a file.

The reporter keeps at most 10 sanitized reports per page load in memory. It
retries failed uploads when another API request succeeds, at most three sends per
report with a five-second timeout. There is no background retry timer or recursive
error reporting. Reports recovered by safe GET retries are included so transient
failures no longer disappear. A reload/closed tab loses unuploaded reports.
Existing D1 retention remains 14-day request-triggered cleanup and 500 stored rows;
report metadata is stored in the existing `detail` column, so no migration is needed.

## Access and limitations

Cloudflare dashboard access is required to inspect provider exceptions. On
9 October 2026 the existing Wrangler OAuth credential could read aggregate
analytics but the historical telemetry query returned **403**. Historical log API
access needs a credential with **Workers Observability Write** (the query API's
required permission); keep it outside the repository. The dashboard remains the
operator path. Test access rather than assuming that `wrangler whoami` implies
log-query access.

A runtime crash before any application code, an edge/network outage, or missing
provider retention can still prevent application evidence. The browser's UTC time,
Ray ID and native Cloudflare error code are the fallback. This instrumentation
improves attribution; it does not fix the outage or configure automatic alerts.

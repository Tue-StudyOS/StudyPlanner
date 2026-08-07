/**
 * Replays a recorded StudyPlanner session at ~20 concurrent users.
 *
 *   k6 run load-test/scenario.js                       # 20 VUs, 5 minutes
 *   k6 run --vus 1 --iterations 1 load-test/scenario.js # smoke check first
 *
 * Requires:
 *   - load-test/sessions.json        (node load-test/mint-sessions.mjs)
 *   - load-test/recorded-session.json (node load-test/build-scenario.mjs)
 *
 * Targets the Worker origin, because that is what the deployed frontend calls:
 * VITE_API_BASE_URL is baked into the Pages build, so browsers go straight to
 * studyplanner-api.*.workers.dev and the same-origin /api/* Pages Function is
 * not in the user path at all. Verified against the live bundle — see
 * docs/load-test-2026-08.md.
 *
 * Shape of the run: each VU does one expensive first load (the app caches
 * catalog, progress and planner data in sessionStorage for 24h), then loops a
 * lighter steady state. That mirrors the scenario under test — twenty people
 * opening the app at the start of a lecture — rather than sustained traffic no
 * real user generates.
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { scenario } from 'k6/execution'

const AUTH_COOKIE_NAME = 'studyplanner_session'
const DEFAULT_ORIGIN = 'https://studyplanner-api.ben-tischberger.workers.dev'

// Think time between steps. A hot loop is not a user simulation: it changes
// both the arrival pattern and how many isolates the requests fan across,
// which is the thing under test.
const MIN_THINK_SECONDS = 3
const MAX_THINK_SECONDS = 8

const sessionsFile = JSON.parse(open('./sessions.json'))
const recording = JSON.parse(open('./recorded-session.json'))

const ORIGIN = (__ENV.LOADTEST_ORIGIN || recording.apiOrigin || DEFAULT_ORIGIN).replace(/\/$/, '')

// The finding we care about is 5xx, and an average hides a handful of them.
const serverErrors = new Counter('server_errors')
const rateLimited = new Counter('rate_limited_429')
const clientErrors = new Counter('client_errors_4xx')
const stepDuration = new Trend('step_duration', true)

/**
 * A semester plan that was never saved returns 404, and that is the app working
 * correctly: whether a plan exists is per-account state, not app health. The
 * recording came from an account that had a WS 2026/27 plan; the loadtest
 * accounts do not. Treated as expected so it neither fails the run nor silently
 * inflates http_req_failed.
 */
function expectsNotFound(method, pathWithoutQuery) {
  return method === 'GET' && pathWithoutQuery.startsWith('/api/me/semester-plans/')
}

/**
 * k6 only materialises a tagged sub-metric in the summary when some threshold
 * references it, so tagging step_duration by endpoint is not enough on its own —
 * the per-endpoint numbers the report needs were being collected and then
 * dropped. These thresholds exist to surface the breakdown, not to gate the run,
 * so the condition is one that always holds.
 */
function perEndpointThresholds() {
  const endpoints = new Set(
    [...recording.firstLoad, ...recording.steadyState].map((step) => step.path.split('?')[0]),
  )
  return Object.fromEntries(
    [...endpoints].map((endpoint) => [`step_duration{endpoint:${endpoint}}`, ['p(95)>=0']]),
  )
}

export const options = {
  // k6 reports avg/min/med/p(90)/p(95)/max by default; the report quotes p(99).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Any 5xx fails the run outright.
    server_errors: ['count<1'],
    // A 429 here means the pre-minted sessions were not enough to keep the
    // rate limiter out of the measurement — the run is invalid, not the app.
    rate_limited_429: ['count<1'],
    // A 4xx means the replayed request was malformed — a rig bug, not a finding.
    client_errors_4xx: ['count<1'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    ...perEndpointThresholds(),
  },
}

export function setup() {
  if (recording.source === 'placeholder') {
    console.warn(
      '[scenario] recorded-session.json is still the PLACEHOLDER derived from source code, ' +
        'not a real browser recording. Results describe an assumed request sequence. ' +
        'See load-test/README.md.',
    )
  }
  console.log(
    `[scenario] origin=${ORIGIN} firstLoad=${recording.firstLoad.length} ` +
      `steadyState=${recording.steadyState.length} sessions=${sessionsFile.sessions.length}`,
  )
  return { firstLoadSteps: recording.firstLoad.length }
}

function thinkTime() {
  return MIN_THINK_SECONDS + Math.random() * (MAX_THINK_SECONDS - MIN_THINK_SECONDS)
}

function pickSession() {
  // Stable VU-to-account mapping, so one account's rows are not written
  // concurrently by several VUs.
  const sessions = sessionsFile.sessions
  return sessions[(__VU - 1) % sessions.length]
}

function buildHeaders(session, method) {
  const headers = {
    Cookie: `${AUTH_COOKIE_NAME}=${session.sessionCookie}`,
    Accept: 'application/json',
  }
  if (method !== 'GET' && method !== 'HEAD') {
    // require_csrf_protection() rejects mutations on /api/me/* without this.
    headers['X-CSRF-Token'] = session.csrfToken
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

/**
 * Body for the one write in the scenario. Course ids come from the catalog
 * response earlier in the same iteration so the write stores plausible data;
 * an empty plan is still valid if the catalog step returned nothing usable.
 */
function buildWriteBody(courseIds) {
  return JSON.stringify({
    courseIds: courseIds.slice(0, 5),
    hiddenSlotIds: [],
    courseAssignments: {},
  })
}

function collectCourseIds(response) {
  try {
    const payload = response.json()
    const courses = payload && payload.courses
    if (!Array.isArray(courses)) {
      return []
    }
    return courses.map((course) => course.id).filter((id) => Number.isInteger(id))
  } catch {
    return []
  }
}

// Course ids survive across a VU's iterations, the way a browser keeps the
// cached catalog after the first load.
let cachedCourseIds = []

function runSteps(steps, session) {
  for (const step of steps) {
    const pathWithoutQuery = step.path.split('?')[0]
    const isWrite = step.method !== 'GET' && step.method !== 'HEAD'
    const body = isWrite ? buildWriteBody(cachedCourseIds) : null

    const notFoundIsExpected = expectsNotFound(step.method, pathWithoutQuery)

    const response = http.request(step.method, `${ORIGIN}${step.path}`, body, {
      headers: buildHeaders(session, step.method),
      // Group metrics by endpoint rather than by unique URL.
      tags: { endpoint: pathWithoutQuery, method: step.method },
      redirects: 0,
      // Drives http_req_failed, so an expected 404 does not read as a failure.
      responseCallback: notFoundIsExpected
        ? http.expectedStatuses(404, { min: 200, max: 299 })
        : http.expectedStatuses({ min: 200, max: 299 }),
    })

    stepDuration.add(response.timings.duration, { endpoint: pathWithoutQuery })

    const isExpected =
      (response.status >= 200 && response.status < 300)
      || (notFoundIsExpected && response.status === 404)

    if (response.status >= 500) {
      serverErrors.add(1, { endpoint: pathWithoutQuery })
    } else if (response.status === 429) {
      rateLimited.add(1, { endpoint: pathWithoutQuery })
    } else if (!isExpected) {
      // Previously only 5xx was logged, so a 4xx from a malformed replay body
      // was invisible in the output and only showed up as a threshold breach.
      clientErrors.add(1, { endpoint: pathWithoutQuery })
    }

    if (!isExpected) {
      console.error(
        `[scenario] ${response.status} ${step.method} ${pathWithoutQuery} ` +
          `vu=${__VU} iter=${scenario.iterationInTest} body=${String(response.body).slice(0, 200)}`,
      )
    }

    check(response, {
      'status is not 5xx': (r) => r.status < 500,
      'status is not 429': (r) => r.status !== 429,
      'status is expected': () => isExpected,
    }, { endpoint: pathWithoutQuery })

    if (pathWithoutQuery === '/api/catalog/courses' && response.status === 200) {
      cachedCourseIds = collectCourseIds(response)
    }

    sleep(thinkTime())
  }
}

export default function runUserSession() {
  const session = pickSession()

  // __ITER is per-VU, so iteration 0 is this virtual user's session start: the
  // one time the catalog, progress and planner payloads actually cross the
  // network. Every later iteration is a returning view served from cache.
  if (__ITER === 0) {
    runSteps(recording.firstLoad, session)
  }

  runSteps(recording.steadyState, session)
}

function counterValue(data, metricName) {
  const metric = data.metrics[metricName]
  return metric ? metric.values.count : 0
}

function formatLatency(data, metricName) {
  const metric = data.metrics[metricName]
  // k6 names the percentile keys 'p(95)', not 'p95'. Guarding on the wrong key
  // made this print n/a on every run while the numbers were sitting right there.
  if (!metric || metric.values['p(95)'] === undefined) {
    return `${metricName}: n/a`
  }
  const { med, 'p(95)': p95, 'p(99)': p99, max } = metric.values
  return `${metricName}: med=${med.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${(p99 ?? 0).toFixed(0)}ms max=${max.toFixed(0)}ms`
}

/**
 * Overriding handleSummary replaces k6's built-in table, so this reprints the
 * numbers the report needs. The full dataset (including per-endpoint tags) goes
 * to JSON so docs/load-test-*.md can quote raw figures rather than a summary of
 * a summary.
 */
export function handleSummary(data) {
  const serverErrorCount = counterValue(data, 'server_errors')
  const rateLimitedCount = counterValue(data, 'rate_limited_429')
  const clientErrorCount = counterValue(data, 'client_errors_4xx')
  const failedRate = data.metrics.http_req_failed
    ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2)
    : 'n/a'

  const lines = [
    '',
    '=== StudyPlanner concurrent-user run ===',
    `requests:        ${counterValue(data, 'http_reqs')}`,
    `failed:          ${failedRate}%`,
    `server_errors:   ${serverErrorCount}${serverErrorCount > 0 ? '   <-- FAIL: 5xx observed' : ''}`,
    `rate_limited:    ${rateLimitedCount}${rateLimitedCount > 0 ? '   <-- run invalid: limiter was hit' : ''}`,
    `client_errors:   ${clientErrorCount}${clientErrorCount > 0 ? '   <-- rig bug: replayed request was malformed' : ''}`,
    formatLatency(data, 'http_req_duration'),
    formatLatency(data, 'step_duration'),
    'full per-endpoint data: load-test/results/summary.json',
    '',
  ]

  return {
    stdout: lines.join('\n'),
    'load-test/results/summary.json': JSON.stringify(data, null, 2),
  }
}

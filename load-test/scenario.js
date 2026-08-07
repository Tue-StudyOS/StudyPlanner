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
 * Targets the Pages origin, not the Worker origin. Requests must pass through
 * the Pages Function and its service binding
 * (frontend/functions/_shared/proxy.ts) — that is the path where the Pyodide
 * cold-start 500s appear. Hitting studyplanner-api.*.workers.dev directly
 * bypasses it and cannot reproduce them.
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { scenario } from 'k6/execution'

const AUTH_COOKIE_NAME = 'studyplanner_session'
const DEFAULT_ORIGIN = 'https://studyplaner.pages.dev'

// Think time between steps. A hot loop is not a user simulation: it changes
// both the arrival pattern and how many isolates the requests fan across,
// which is the thing under test.
const MIN_THINK_SECONDS = 3
const MAX_THINK_SECONDS = 8

const sessionsFile = JSON.parse(open('./sessions.json'))
const recording = JSON.parse(open('./recorded-session.json'))

const ORIGIN = (__ENV.LOADTEST_ORIGIN || sessionsFile.origin || DEFAULT_ORIGIN).replace(/\/$/, '')

// The finding we care about is 5xx, and an average hides a handful of them.
const serverErrors = new Counter('server_errors')
const rateLimited = new Counter('rate_limited_429')
const stepDuration = new Trend('step_duration', true)

export const options = {
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
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
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
  console.log(`[scenario] origin=${ORIGIN} steps=${recording.steps.length} sessions=${sessionsFile.sessions.length}`)
  return { stepCount: recording.steps.length }
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

export default function runUserSession() {
  const session = pickSession()
  let courseIds = []

  for (const step of recording.steps) {
    const pathWithoutQuery = step.path.split('?')[0]
    const isWrite = step.method !== 'GET' && step.method !== 'HEAD'
    const body = isWrite ? buildWriteBody(courseIds) : null

    const response = http.request(step.method, `${ORIGIN}${step.path}`, body, {
      headers: buildHeaders(session, step.method),
      // Group metrics by endpoint rather than by unique URL.
      tags: { endpoint: pathWithoutQuery, method: step.method },
      redirects: 0,
    })

    stepDuration.add(response.timings.duration, { endpoint: pathWithoutQuery })

    if (response.status >= 500) {
      serverErrors.add(1, { endpoint: pathWithoutQuery })
      console.error(
        `[scenario] ${response.status} ${step.method} ${pathWithoutQuery} ` +
          `vu=${__VU} iter=${scenario.iterationInTest} body=${String(response.body).slice(0, 200)}`,
      )
    }
    if (response.status === 429) {
      rateLimited.add(1, { endpoint: pathWithoutQuery })
    }

    check(response, {
      'status is not 5xx': (r) => r.status < 500,
      'status is not 429': (r) => r.status !== 429,
      'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    }, { endpoint: pathWithoutQuery })

    if (pathWithoutQuery === '/api/catalog/courses' && response.status === 200) {
      courseIds = collectCourseIds(response)
    }

    sleep(thinkTime())
  }
}

function counterValue(data, metricName) {
  const metric = data.metrics[metricName]
  return metric ? metric.values.count : 0
}

function formatLatency(data, metricName) {
  const metric = data.metrics[metricName]
  if (!metric || metric.values.p95 === undefined) {
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

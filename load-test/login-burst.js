/**
 * Phase D: how does login behave when several people sign in at once?
 *
 *   k6 run load-test/login-burst.js
 *
 * Login is the most CPU-expensive request in the app: _hash_password() runs
 * PBKDF2-HMAC-SHA256 at 310,000 iterations
 * (backend/src/services/authentication.py) inside Pyodide, on top of a D1 write
 * from the rate limiter itself.
 *
 * Deliberately 8 VUs, one iteration each: AUTH_LOGIN_POLICY allows 10 logins
 * per 15-minute window per IP, so 8 measures login cost with headroom instead
 * of measuring the limiter. Raising this above 9 will produce 429s.
 *
 * Consumes login budget for the whole IP — do not run this within 15 minutes of
 * mint-sessions.mjs.
 */

import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

const DEFAULT_ORIGIN = 'https://studyplaner.pages.dev'
const ORIGIN = (__ENV.LOADTEST_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '')
const PASSWORD = __ENV.LOADTEST_PASSWORD

const BURST_SIZE = 8

const rateLimited = new Counter('rate_limited_429')

export const options = {
  scenarios: {
    login_burst: {
      executor: 'per-vu-iterations',
      vus: BURST_SIZE,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    rate_limited_429: ['count<1'],
    http_req_failed: ['rate<0.01'],
  },
}

export function setup() {
  if (!PASSWORD) {
    throw new Error('Run with -e LOADTEST_PASSWORD=<value>')
  }
  console.log(`[login-burst] ${BURST_SIZE} simultaneous logins against ${ORIGIN}`)
}

export default function login() {
  const username = `loadtest-${String(__VU).padStart(2, '0')}@example.com`
  const response = http.post(
    `${ORIGIN}/api/auth/login`,
    JSON.stringify({ identifier: username, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: '/api/auth/login' } },
  )

  if (response.status === 429) {
    rateLimited.add(1)
  }

  check(response, {
    'login succeeded': (r) => r.status === 200,
    'not rate limited': (r) => r.status !== 429,
  })

  console.log(`[login-burst] vu=${__VU} status=${response.status} duration=${response.timings.duration.toFixed(0)}ms`)
}

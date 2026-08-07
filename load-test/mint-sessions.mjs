/**
 * Logs the seeded loadtest-* accounts in and saves their session cookies for k6.
 *
 *   node load-test/mint-sessions.mjs --count 20
 *
 * Run this well before the load run, not as part of it. AUTH_LOGIN_POLICY
 * (backend/src/services/request_rate_limit.py) allows 10 logins per 15-minute
 * window per client IP, so minting 20 sessions from one machine spans two
 * windows. Doing it inside the load test would mean measuring the rate limiter
 * instead of the app.
 *
 * The rate limiter uses a fixed window aligned to wall-clock time
 * (`now - (now % window_seconds)`), so this waits for the next 900s boundary
 * rather than sleeping a blind 15 minutes.
 *
 * Sessions stay valid for AUTH_TOKEN_TTL_SECONDS (30 days), so one mint covers
 * many runs.
 *
 * Output: load-test/sessions.json — gitignored, it contains live session
 * cookies. Treat it as a credential file.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(SCRIPT_DIR, 'sessions.json')

const DEFAULT_ORIGIN = 'https://studyplaner.pages.dev'
const DEFAULT_COUNT = 20
const ACCOUNT_TEMPLATE = (index) => `loadtest-${String(index).padStart(2, '0')}@example.com`

const AUTH_COOKIE_NAME = 'studyplanner_session'
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_LIMIT_PER_WINDOW = 10
// One request of headroom, so an unrelated login from the same IP does not
// push the batch over the limit.
const LOGINS_PER_BATCH = LOGIN_LIMIT_PER_WINDOW - 1

function parseArguments(argv) {
  const args = { origin: DEFAULT_ORIGIN, count: DEFAULT_COUNT }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--origin') {
      args.origin = argv[index + 1]
      index += 1
    } else if (flag === '--count') {
      args.count = Number.parseInt(argv[index + 1], 10)
      index += 1
    }
  }
  if (!Number.isInteger(args.count) || args.count < 1) {
    throw new Error('--count must be a positive integer')
  }
  return args
}

function extractSessionCookie(setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';')
    const separatorIndex = pair.indexOf('=')
    if (pair.slice(0, separatorIndex).trim() === AUTH_COOKIE_NAME) {
      return pair.slice(separatorIndex + 1).trim()
    }
  }
  return null
}

function secondsUntilNextWindow() {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const nextBoundary = (Math.floor(nowSeconds / LOGIN_WINDOW_SECONDS) + 1) * LOGIN_WINDOW_SECONDS
  // One extra second so the boundary has definitely passed server-side.
  return nextBoundary - nowSeconds + 1
}

function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}

async function login(origin, username, password) {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: username, password }),
    redirect: 'manual',
  })

  const bodyText = await response.text()
  if (response.status === 429) {
    throw new Error(`rate limited (429) for ${username}; retry after the next 15-minute window`)
  }
  if (!response.ok) {
    throw new Error(`login failed for ${username}: ${response.status} ${bodyText.slice(0, 200)}`)
  }

  const sessionCookie = extractSessionCookie(response.headers.getSetCookie())
  if (!sessionCookie) {
    throw new Error(`login for ${username} returned no ${AUTH_COOKIE_NAME} cookie`)
  }

  const payload = JSON.parse(bodyText)
  if (!payload.csrfToken) {
    throw new Error(`login for ${username} returned no csrfToken`)
  }

  return { username, sessionCookie, csrfToken: payload.csrfToken }
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const password = (process.env.LOADTEST_PASSWORD ?? '').trim()
  if (!password) {
    throw new Error(
      'LOADTEST_PASSWORD is not set. Use the same value passed to seed_load_test_users.py.',
    )
  }

  const usernames = Array.from({ length: args.count }, (_, index) => ACCOUNT_TEMPLATE(index + 1))
  const sessions = []

  console.log(`[mint] ${usernames.length} accounts against ${args.origin}`)
  console.log(`[mint] batches of ${LOGINS_PER_BATCH} per ${LOGIN_WINDOW_SECONDS / 60}-minute window`)

  for (let index = 0; index < usernames.length; index += 1) {
    if (index > 0 && index % LOGINS_PER_BATCH === 0) {
      const waitSeconds = secondsUntilNextWindow()
      console.log(`[mint] login window full — waiting ${waitSeconds}s for the next window ...`)
      await sleep(waitSeconds)
    }

    const username = usernames[index]
    const session = await login(args.origin, username, password)
    sessions.push(session)
    console.log(`[mint] ${index + 1}/${usernames.length} ${username}`)
  }

  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ origin: args.origin, mintedAt: new Date().toISOString(), sessions }, null, 2)}\n`,
    'utf8',
  )
  console.log(`[mint] wrote ${OUTPUT_PATH} (${sessions.length} sessions)`)
  console.log('[mint] this file contains live session cookies — it is gitignored, do not share it')
}

main().catch((error) => {
  console.error(`[mint] ${error.message}`)
  process.exitCode = 1
})

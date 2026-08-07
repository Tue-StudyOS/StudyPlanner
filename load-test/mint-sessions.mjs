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

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(SCRIPT_DIR, 'sessions.json')

const DEFAULT_ORIGIN = 'https://studyplanner-api.ben-tischberger.workers.dev'
const DEFAULT_COUNT = 20
const ACCOUNT_TEMPLATE = (index) => `loadtest-${String(index).padStart(2, '0')}@example.com`

const AUTH_COOKIE_NAME = 'studyplanner_session'
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_LIMIT_PER_WINDOW = 10
// One request of headroom, so an unrelated login from the same IP does not
// push the batch over the limit.
const LOGINS_PER_BATCH = LOGIN_LIMIT_PER_WINDOW - 1

const LOGIN_ATTEMPTS = 3
const RETRY_BACKOFF_SECONDS = 5

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

/**
 * A failing Worker returns a Cloudflare HTML interstitial, not the app's JSON
 * error. Truncating that HTML hides the only two useful facts in it: the
 * Cloudflare error code (1101 = Worker threw, 1102 = CPU limit exceeded,
 * 1015 = rate limited) and the Ray ID needed to correlate with `wrangler tail`.
 */
function describeGatewayFailure(status, bodyText, headers) {
  const errorCode = bodyText.match(/Error\s*(\d{4})/)?.[1]
  const rayId = headers.get('cf-ray') ?? bodyText.match(/Ray ID:\s*<\/span>\s*<span[^>]*>([0-9a-f]+)/i)?.[1]
  const summary = bodyText.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1].replace(/<[^>]+>/g, '').trim()

  const parts = [`HTTP ${status}`]
  if (errorCode) {
    parts.push(`Cloudflare error ${errorCode}`)
  }
  if (summary) {
    parts.push(summary)
  }
  if (rayId) {
    parts.push(`ray=${rayId}`)
  }
  return parts.join(' | ')
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
    const isHtml = bodyText.trimStart().startsWith('<')
    const detail = isHtml
      ? describeGatewayFailure(response.status, bodyText, response.headers)
      : `${response.status} ${bodyText.slice(0, 200)}`
    throw new Error(`login failed for ${username}: ${detail}`)
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

async function waitForNextWindow(reason) {
  const waitSeconds = secondsUntilNextWindow()
  console.log(`[mint] ${reason} — waiting ${waitSeconds}s for the next window ...`)
  await sleep(waitSeconds)
}

function readExistingSessions(origin) {
  if (!existsSync(OUTPUT_PATH)) {
    return []
  }
  try {
    const parsed = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    if (parsed.origin !== origin || !Array.isArray(parsed.sessions)) {
      return []
    }
    return parsed.sessions
  } catch {
    return []
  }
}

/**
 * A 5xx here is the behaviour under investigation, not just noise, so each
 * attempt is logged rather than silently swallowed. Retrying distinguishes a
 * transient blip from a Worker that reliably fails on this request.
 */
async function loginWithRetry(origin, username, password) {
  let lastError
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    try {
      return await login(origin, username, password)
    } catch (error) {
      lastError = error
      if (error.message.includes('rate limited')) {
        throw error
      }
      if (attempt < LOGIN_ATTEMPTS) {
        console.warn(`[mint] ${username} attempt ${attempt}/${LOGIN_ATTEMPTS} failed: ${error.message}`)
        await sleep(RETRY_BACKOFF_SECONDS * attempt)
      }
    }
  }
  throw lastError
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

  // Resume from a previous partial run. Logins are a scarce resource here
  // (10 per 15 minutes per IP), so already-minted sessions are not re-spent.
  const sessions = readExistingSessions(args.origin)
  const alreadyMinted = new Set(sessions.map((session) => session.username))
  if (alreadyMinted.size > 0) {
    console.log(`[mint] resuming — ${alreadyMinted.size} session(s) already in ${OUTPUT_PATH}`)
  }

  const pending = usernames.filter((username) => !alreadyMinted.has(username))
  const failures = []

  console.log(`[mint] ${pending.length} account(s) to mint against ${args.origin}`)
  console.log(`[mint] batches of ${LOGINS_PER_BATCH} per ${LOGIN_WINDOW_SECONDS / 60}-minute window`)

  let loginsThisWindow = 0
  let index = 0
  while (index < pending.length) {
    if (loginsThisWindow >= LOGINS_PER_BATCH) {
      await waitForNextWindow('login window full')
      loginsThisWindow = 0
    }

    const username = pending[index]
    try {
      const session = await loginWithRetry(args.origin, username, password)
      sessions.push(session)
      console.log(`[mint] ${sessions.length}/${usernames.length} ${username}`)
    } catch (error) {
      if (error.message.includes('rate limited')) {
        // The window budget was already partly spent before this run started
        // (failed attempts count too). Wait it out and retry the same account
        // rather than burning it as a failure.
        await waitForNextWindow('hit the rate limit')
        loginsThisWindow = 0
        continue
      }
      // Keep going: a partial set still lets the run proceed at lower VU count,
      // and the failure list is itself a result worth reporting.
      failures.push({ username, error: error.message })
      console.error(`[mint] FAILED ${username}: ${error.message}`)
    }
    loginsThisWindow += 1
    index += 1
  }

  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ origin: args.origin, mintedAt: new Date().toISOString(), sessions }, null, 2)}\n`,
    'utf8',
  )
  console.log(`[mint] wrote ${OUTPUT_PATH} (${sessions.length}/${usernames.length} sessions)`)
  console.log('[mint] this file contains live session cookies — it is gitignored, do not share it')

  if (failures.length > 0) {
    console.error(`\n[mint] ${failures.length} account(s) failed after ${LOGIN_ATTEMPTS} attempts each:`)
    for (const { username, error } of failures) {
      console.error(`  ${username}: ${error}`)
    }
    console.error('[mint] re-run to retry only the missing accounts.')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`[mint] ${error.message}`)
  process.exitCode = 1
})

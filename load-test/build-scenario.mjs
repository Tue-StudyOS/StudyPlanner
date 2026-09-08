/**
 * Turns a real browser session into the request sequence k6 replays.
 *
 *   node load-test/build-scenario.mjs <raw-dump.json>
 *
 * Input is a dump of `sessionStorage['studyplanner:api-request-log']`, which the
 * app already maintains for its own diagnostics
 * (frontend/src/shared/utils/apiRequestLog.ts). Entries are stored newest-first
 * and capped at 80, so this reverses them into chronological order.
 *
 * The point of generating the scenario rather than hand-writing it: a
 * hand-written request list tests an assumption about what the app does. A
 * recording is what it actually did. See load-test/README.md for how to capture
 * the dump.
 *
 * Output: load-test/recorded-session.json — committed, so a run is reproducible
 * and the recording can be refreshed when the frontend changes.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(SCRIPT_DIR, 'recorded-session.json')

// The deployed frontend calls the Worker directly (VITE_API_BASE_URL is baked
// into the Pages build), so this is the origin real users hit — not the
// same-origin /api/* path served by the Pages Function.
const DEFAULT_API_ORIGIN = 'https://studyplanner-api.ben-tischberger.workers.dev'

/**
 * Endpoints the frontend caches in sessionStorage for 24h
 * (frontend/src/shared/utils/sessionCache.ts). A real user hits these once when
 * the browser session starts and then reads from cache, so replaying them every
 * iteration would invent backend load that does not exist.
 *
 * They are split into a first-load phase that each VU runs once. That also
 * happens to be the realistic shape of the scenario under test: twenty people
 * opening the app at the start of a lecture is a burst of expensive session
 * starts, not sustained traffic.
 */
/** Fetched once when the app boots, not on every view change. */
const BOOTSTRAP_PATHS = new Set([
  '/api/config',
  '/api/auth/session',
  '/api/me/profile',
  '/api/study-programs',
  '/api/me/favorites',
])

const SESSION_CACHED_PATHS = new Set([
  '/api/catalog/courses',
  '/api/catalog/periods',
  '/api/me/progress',
  '/api/me/semester-plans',
  '/api/me/completed-courses',
  '/api/me/transcript-data',
  '/api/me/transcript-issues',
])

/**
 * Endpoints that must never be replayed under load, with the reason.
 * Keep in sync with the policies in backend/src/services/request_rate_limit.py.
 *
 * Keys are either a bare path (excludes every method) or `METHOD /path`, which
 * excludes just that verb — the transcript endpoints are read normally on every
 * page load but written only during one-time onboarding.
 */
const EXCLUDED_PATHS = new Map([
  ['/api/auth/login', 'rate limited to 10/15min per IP; sessions are pre-minted instead'],
  ['/api/auth/register', 'rate limited to 5/hour per IP'],
  ['/api/auth/logout', 'would invalidate the pre-minted session mid-run'],
  ['/api/feedback', 'rate limited to 5/hour per IP and writes user-visible feedback rows'],
  ['/api/client-errors', 'rate limited to 30/hour per IP and pollutes the diagnostics view'],
  // The request log records method, URL and status but never request bodies, so
  // any replayed write has to be synthesised. That is tractable for a semester
  // plan and not for a transcript import, which needs a parsed transcript.
  // Both rejected the synthesised body with 400 during the Phase B smoke run.
  // Excluding them also matches real traffic: importing a transcript is a
  // once-per-user onboarding step, not something twenty concurrent users do.
  ['POST /api/me/completed-courses/import', 'one-time onboarding write; needs a real parsed transcript body'],
  ['PUT /api/me/transcript-issues', 'follow-up write of the transcript import flow; needs a real issues body'],
])

function exclusionFor(method, pathWithoutQuery) {
  return EXCLUDED_PATHS.get(`${method} ${pathWithoutQuery}`) ?? EXCLUDED_PATHS.get(pathWithoutQuery)
}

function toPath(rawUrl) {
  try {
    return new URL(rawUrl).pathname + new URL(rawUrl).search
  } catch {
    // The log stores same-origin relative URLs when VITE_API_BASE_URL is unset.
    return rawUrl
  }
}

function isSessionCached(pathWithoutQuery) {
  if (SESSION_CACHED_PATHS.has(pathWithoutQuery)) {
    return true
  }
  // Course detail is cached per course id.
  return pathWithoutQuery.startsWith('/api/catalog/courses/')
}

function buildSteps(entries) {
  const chronological = [...entries].sort((left, right) => left.timestamp - right.timestamp)
  const firstLoad = []
  const steadyState = []
  const skipped = []
  const seenCachedPaths = new Set()

  for (const entry of chronological) {
    const path = toPath(entry.url)
    const pathWithoutQuery = path.split('?')[0]

    if (!pathWithoutQuery.startsWith('/api/')) {
      continue
    }
    const method = (entry.method ?? 'GET').toUpperCase()
    const exclusionReason = exclusionFor(method, pathWithoutQuery)
    if (exclusionReason) {
      skipped.push({ path: `${method} ${pathWithoutQuery}`, reason: exclusionReason })
      continue
    }

    const step = {
      method,
      path,
      observedStatus: entry.status,
      observedDurationMs: entry.durationMs ?? null,
    }

    const isRead = step.method === 'GET'
    const runsOncePerSession = isRead
      && (BOOTSTRAP_PATHS.has(pathWithoutQuery) || isSessionCached(pathWithoutQuery))

    if (runsOncePerSession) {
      // Only the first occurrence reaches the network in a real session; later
      // ones come from sessionStorage or are simply not re-requested.
      if (!seenCachedPaths.has(path)) {
        seenCachedPaths.add(path)
        firstLoad.push(step)
      }
      continue
    }

    // Uncached reads and every write happen throughout the session.
    steadyState.push(step)
  }

  return { firstLoad, steadyState, skipped }
}

function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error('Usage: node load-test/build-scenario.mjs <raw-dump.json>')
  }

  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : parsed.entries
  if (!Array.isArray(entries)) {
    throw new Error('Input must be the sessionStorage array, or an object with an `entries` array.')
  }

  const { firstLoad, steadyState, skipped } = buildSteps(entries)
  if (firstLoad.length === 0 && steadyState.length === 0) {
    throw new Error('No /api/ requests found in the dump — was the log captured after a page reload?')
  }

  const recording = {
    source: 'recorded',
    recordedAt: new Date().toISOString(),
    apiOrigin: DEFAULT_API_ORIGIN,
    firstLoad,
    steadyState,
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(recording, null, 2)}\n`, 'utf8')
  console.log(
    `[build-scenario] wrote ${OUTPUT_PATH} ` +
      `(${firstLoad.length} first-load steps, ${steadyState.length} steady-state steps)`,
  )
  for (const { path, reason } of skipped) {
    console.log(`[build-scenario] excluded ${path} — ${reason}`)
  }
  if (steadyState.length === 0) {
    console.warn(
      '[build-scenario] no steady-state steps: the recording only covers a session start. ' +
        'Walk further through the app (open courses, edit a plan) and re-record.',
    )
  }
}

try {
  main()
} catch (error) {
  console.error(`[build-scenario] ${error.message}`)
  process.exitCode = 1
}

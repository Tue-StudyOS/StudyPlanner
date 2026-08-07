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

/**
 * Endpoints that must never be replayed under load, with the reason.
 * Keep in sync with the policies in backend/src/services/request_rate_limit.py.
 */
const EXCLUDED_PATHS = new Map([
  ['/api/auth/login', 'rate limited to 10/15min per IP; sessions are pre-minted instead'],
  ['/api/auth/register', 'rate limited to 5/hour per IP'],
  ['/api/auth/logout', 'would invalidate the pre-minted session mid-run'],
  ['/api/feedback', 'rate limited to 5/hour per IP and writes user-visible feedback rows'],
  ['/api/client-errors', 'rate limited to 30/hour per IP and pollutes the diagnostics view'],
])

function toPath(rawUrl) {
  try {
    return new URL(rawUrl).pathname + new URL(rawUrl).search
  } catch {
    // The log stores same-origin relative URLs when VITE_API_BASE_URL is unset.
    return rawUrl
  }
}

function buildSteps(entries) {
  const chronological = [...entries].sort((left, right) => left.timestamp - right.timestamp)
  const steps = []
  const skipped = []

  for (const entry of chronological) {
    const path = toPath(entry.url)
    const pathWithoutQuery = path.split('?')[0]

    if (!pathWithoutQuery.startsWith('/api/')) {
      continue
    }
    const exclusionReason = EXCLUDED_PATHS.get(pathWithoutQuery)
    if (exclusionReason) {
      skipped.push({ path: pathWithoutQuery, reason: exclusionReason })
      continue
    }

    steps.push({
      method: (entry.method ?? 'GET').toUpperCase(),
      path,
      observedStatus: entry.status,
      observedDurationMs: entry.durationMs ?? null,
    })
  }

  return { steps, skipped }
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

  const { steps, skipped } = buildSteps(entries)
  if (steps.length === 0) {
    throw new Error('No /api/ requests found in the dump — was the log captured after a page reload?')
  }

  const recording = {
    source: 'recorded',
    recordedAt: new Date().toISOString(),
    stepCount: steps.length,
    steps,
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(recording, null, 2)}\n`, 'utf8')
  console.log(`[build-scenario] wrote ${OUTPUT_PATH} (${steps.length} steps)`)
  for (const { path, reason } of skipped) {
    console.log(`[build-scenario] excluded ${path} — ${reason}`)
  }
}

try {
  main()
} catch (error) {
  console.error(`[build-scenario] ${error.message}`)
  process.exitCode = 1
}

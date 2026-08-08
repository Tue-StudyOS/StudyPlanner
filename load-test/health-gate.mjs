/**
 * Preflight that refuses to let a load measurement start on a wedged Worker.
 *
 * Why it exists: an isolate that has hung stays hung, so a run started on a
 * dirty Worker measures leftover damage from the previous run. Earlier results
 * in docs/load-test-2026-08.md were invalidated exactly this way — the check in
 * place then warned and continued.
 *
 * This one **exits non-zero**. Chain it with `&&` so the load run cannot start:
 *
 *   node load-test/health-gate.mjs --origin https://... && k6 run ...
 *
 * A single connection pins to one isolate, so one probe request only proves one
 * isolate is alive. The gate therefore opens several connections in parallel and
 * repeats, to sample as much of the isolate pool as it can reach.
 */

const DEFAULT_ORIGIN = 'https://studyplanner-api.ben-tischberger.workers.dev'
const ISOLATE_HEADERS = ['x-isolate-id', 'x-probe-isolate']

function parseArgs(argv) {
  const args = {
    origin: DEFAULT_ORIGIN,
    path: '/health',
    connections: 8,
    rounds: 3,
    waitSeconds: 0,
    timeoutMs: 15000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--origin':
        args.origin = value
        index += 1
        break
      case '--path':
        args.path = value
        index += 1
        break
      case '--connections':
        args.connections = Number(value)
        index += 1
        break
      case '--rounds':
        args.rounds = Number(value)
        index += 1
        break
      case '--wait':
        args.waitSeconds = Number(value)
        index += 1
        break
      case '--timeout-ms':
        args.timeoutMs = Number(value)
        index += 1
        break
      default:
        break
    }
  }
  // Git Bash rewrites a leading-slash argument into a Windows path, which would
  // otherwise be concatenated onto the origin and fail DNS with a confusing
  // ENOTFOUND rather than reporting a bad path.
  if (/^[A-Za-z]:[\\/]/.test(args.path)) {
    throw new Error(
      `--path was rewritten by the shell to "${args.path}". ` +
        'Prefix the command with MSYS_NO_PATHCONV=1, or run it from PowerShell.',
    )
  }
  if (!args.path.startsWith('/')) {
    args.path = `/${args.path}`
  }
  return args
}

function readIsolateId(response) {
  for (const name of ISOLATE_HEADERS) {
    const value = response.headers.get(name)
    if (value) {
      return value
    }
  }
  return null
}

function describeError(error) {
  if (!(error instanceof Error)) {
    return String(error)
  }
  const cause = error.cause
  if (cause instanceof Error) {
    const code = cause.code ? ` [${cause.code}]` : ''
    return `${error.message}: ${cause.message}${code}`
  }
  return error.message
}

async function probeOnce(url, timeoutMs) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.signal.aborted || controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    // The body must be drained, otherwise a hang that only manifests while
    // streaming the body would be scored as a success.
    await response.arrayBuffer()
    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      isolate: readIsolateId(response),
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      isolate: null,
      durationMs: Date.now() - startedAt,
      // `fetch failed` on its own is useless for deciding whether the Worker or
      // the test machine is at fault, so the underlying cause is kept.
      error: describeError(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function sampleOnce(args) {
  const url = `${args.origin}${args.path}`
  const results = []
  for (let round = 0; round < args.rounds; round += 1) {
    const batch = await Promise.all(
      Array.from({ length: args.connections }, () => probeOnce(url, args.timeoutMs)),
    )
    results.push(...batch)
  }
  const failures = results.filter((result) => !result.ok)
  const isolates = new Set(results.map((result) => result.isolate).filter(Boolean))
  return { results, failures, isolates }
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const deadline = Date.now() + args.waitSeconds * 1000
  let sample = null

  for (;;) {
    sample = await sampleOnce(args)
    const total = sample.results.length
    const durations = sample.results.map((result) => result.durationMs).sort((a, b) => a - b)
    const median = durations[Math.floor(durations.length / 2)]
    console.log(
      `[gate] ${total - sample.failures.length}/${total} ok, ` +
        `${sample.isolates.size} distinct isolate(s), median ${median}ms`,
    )
    if (sample.failures.length === 0) {
      break
    }
    for (const failure of sample.failures.slice(0, 5)) {
      console.log(`[gate]   failure status=${failure.status} ${failure.error ?? ''}`.trimEnd())
    }
    if (Date.now() >= deadline) {
      break
    }
    console.log('[gate] not clean; waiting 15s before re-checking')
    await sleep(15)
  }

  if (sample.failures.length > 0) {
    console.error(
      `\n[gate] ABORT — ${sample.failures.length} of ${sample.results.length} probe requests failed.\n` +
        '[gate] The Worker is not in a clean state. Any measurement started now is invalid.\n' +
        '[gate] Redeploy to unwedge, then re-run this gate.',
    )
    process.exit(1)
  }

  // A pool this small means the sample barely covered it; the run may still be
  // valid, but a later wedge would be hard to attribute.
  if (sample.isolates.size > 0 && sample.isolates.size < 3) {
    console.warn(`[gate] note: only ${sample.isolates.size} isolate(s) observed`)
  }
  console.log('[gate] clean — safe to measure')
}

main().catch((error) => {
  console.error(`[gate] ABORT — gate itself failed: ${error.message}`)
  process.exit(1)
})

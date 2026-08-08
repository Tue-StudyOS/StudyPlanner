/**
 * Single-isolate instrument for the Pyodide hang investigation.
 *
 * Everything here rests on one measured fact: a connection pins to one Worker
 * isolate. One HTTP/2 session is therefore one isolate, and concurrent streams
 * on that session are concurrent tasks inside one Python event loop — which is
 * the condition the hang needs. k6 can generate this too, but not while also
 * reading state back out of the isolate between steps, which is what these
 * experiments require.
 *
 * Commands
 *   heap                        report the serving isolate's memory
 *   ramp-ballast                grow resident memory until the isolate dies
 *   threshold                   find the concurrent payload size that hangs it
 *   ballast-effect              does resident memory reduce that threshold?
 *
 * Usage
 *   node load-test/isolate-probe.mjs ramp-ballast --step 8 --max 200
 *   node load-test/isolate-probe.mjs threshold --ballast 0 --batch 4
 *   node load-test/isolate-probe.mjs ballast-effect --batch 4 --kb 900
 *
 * The probe Worker (load-test/payload-probe) must be deployed at --origin.
 */
import http2 from 'node:http2'
import { readFileSync } from 'node:fs'

const DEFAULT_ORIGIN = 'https://studyplaner-api.ben-tischberger.workers.dev'
const REQUEST_TIMEOUT_MS = 20000
const AUTH_COOKIE_NAME = 'studyplanner_session'

/**
 * Reuses the sessions minted for the k6 harness. They are valid for 30 days and
 * live in a gitignored file, so nothing here handles credentials directly.
 */
function loadSessionCookie() {
  const file = new URL('./sessions.json', import.meta.url)
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  const session = parsed.sessions[0]
  return `${AUTH_COOKIE_NAME}=${session.sessionCookie}`
}

function parseArgs(argv) {
  const args = {
    command: argv[0] ?? 'heap',
    origin: DEFAULT_ORIGIN,
    step: 8,
    max: 200,
    ballast: 0,
    batch: 4,
    kb: 900,
    kbStep: 200,
    repeats: 1,
    // 1 builds the payload and discards it, so the response stays tiny.
    discard: 0,
    // Idle time between rounds, for testing whether the CPU budget refills.
    gapMs: 0,
    rounds: 60,
    // 1 returns the body pre-encoded as bytes instead of as a str.
    bytesMode: 0,
    // Point the load at a real backend endpoint instead of the probe.
    path: null,
    // Send a minted load-test session cookie, for authenticated endpoints.
    auth: 0,
  }
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index].replace(/^--/, '')
    const value = argv[index + 1]
    if (flag === 'origin' || flag === 'path') {
      args[flag] = value
      index += 1
    } else if (flag in args) {
      args[flag] = Number(value)
      index += 1
    }
  }
  return args
}

/** One HTTP/2 session, i.e. one connection, i.e. one isolate. */
class IsolateSession {
  constructor(origin, cookie = null) {
    this.origin = origin
    this.cookie = cookie
    this.session = null
    this.dead = false
  }

  async open() {
    this.session = http2.connect(this.origin)
    this.session.on('error', () => {
      this.dead = true
    })
    await new Promise((resolve, reject) => {
      this.session.once('connect', resolve)
      this.session.once('error', reject)
    })
    return this
  }

  close() {
    if (this.session && !this.session.destroyed) {
      this.session.close()
    }
  }

  /**
   * Resolves with an outcome rather than rejecting: a hung request is the
   * measurement, not an error, and must not abort the surrounding sweep.
   */
  request(path) {
    const startedAt = Date.now()
    return new Promise((resolve) => {
      if (this.dead || !this.session || this.session.destroyed) {
        resolve({ ok: false, status: 0, reason: 'session_dead', durationMs: 0 })
        return
      }
      let settled = false
      const finish = (outcome) => {
        if (settled) return
        settled = true
        resolve({ ...outcome, durationMs: Date.now() - startedAt })
      }

      let stream
      try {
        const requestHeaders = { ':path': path, ':method': 'GET' }
        if (this.cookie) requestHeaders.cookie = this.cookie
        stream = this.session.request(requestHeaders)
      } catch (error) {
        finish({ ok: false, status: 0, reason: `request_failed: ${error.message}` })
        return
      }

      const timer = setTimeout(() => {
        stream.destroy()
        finish({ ok: false, status: 0, reason: 'timeout' })
      }, REQUEST_TIMEOUT_MS)

      let headers = {}
      let bytes = 0
      const chunks = []
      stream.on('response', (received) => {
        headers = received
      })
      stream.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes < 4096) chunks.push(chunk)
      })
      stream.on('end', () => {
        clearTimeout(timer)
        const status = Number(headers[':status'] ?? 0)
        finish({
          ok: status >= 200 && status < 400,
          status,
          headers,
          bytes,
          body: Buffer.concat(chunks).toString('utf8'),
          isolate: headers['x-probe-isolate'] ?? headers['x-isolate-id'] ?? null,
          heapBytes: headers['x-probe-heap'] ? Number(headers['x-probe-heap']) : null,
          ballastMb: headers['x-probe-ballast-mb'] ? Number(headers['x-probe-ballast-mb']) : null,
        })
      })
      stream.on('error', (error) => {
        clearTimeout(timer)
        finish({ ok: false, status: 0, reason: error.message })
      })
      stream.end()
    })
  }

  /** Concurrent streams on one session: overlapping tasks in one event loop. */
  batch(path, count) {
    return Promise.all(Array.from({ length: count }, () => this.request(path)))
  }
}

const megabytes = (bytes) => (bytes === null ? '?' : `${(bytes / 1048576).toFixed(1)}MB`)

let sharedCookie = null

async function withSession(origin, body) {
  const session = await new IsolateSession(origin, sharedCookie).open()
  try {
    return await body(session)
  } finally {
    session.close()
  }
}

/**
 * How many isolates does one connection actually reach?
 *
 * Every experiment that sets state on an isolate and then measures it depends on
 * the answer, so it is measured here rather than assumed. Sequential and
 * concurrent traffic are reported separately: they need not behave the same,
 * because concurrent streams can be dispatched while an isolate is still busy.
 */
async function commandIsolateMap(args) {
  await withSession(args.origin, async (session) => {
    const sequential = []
    for (let index = 0; index < 30; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequencing is the point
      const result = await session.request('/?kb=1')
      sequential.push(result.isolate ?? `fail:${result.reason ?? result.status}`)
    }
    const concurrent = []
    for (let round = 0; round < 5; round += 1) {
      // eslint-disable-next-line no-await-in-loop -- rounds must not overlap
      const responses = await session.batch('/?kb=1', args.batch)
      concurrent.push(responses.map((r) => r.isolate ?? `fail:${r.reason ?? r.status}`))
    }

    const tally = (ids) => {
      const counts = new Map()
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
      return [...counts.entries()].map(([id, count]) => `${id.slice(0, 8)}x${count}`).join(' ')
    }
    console.log(`[map] sequential order : ${sequential.map((id) => id.slice(0, 4)).join(' ')}`)
    console.log(`[map] sequential tally : ${tally(sequential)}`)
    console.log(`[map] distinct sequential isolates: ${new Set(sequential).size} of 30`)
    for (const [index, round] of concurrent.entries()) {
      console.log(
        `[map] batch ${index} (${args.batch} concurrent): ` +
          `${new Set(round).size} distinct — ${tally(round)}`,
      )
    }
  })
}

async function commandHeap(args) {
  await withSession(args.origin, async (session) => {
    const result = await session.request('/heap')
    console.log(result.ok ? result.body : `failed: ${result.reason}`)
  })
}

/**
 * Grows resident memory one step at a time on a single isolate. If the fault is
 * a memory ceiling, this finds it directly, and the last reported heap size is
 * the ceiling — no inference from failure rates required.
 */
async function commandRampBallast(args) {
  await withSession(args.origin, async (session) => {
    const first = await session.request('/heap')
    if (!first.ok) {
      console.error(`[ramp] could not reach a healthy isolate: ${first.reason}`)
      process.exitCode = 1
      return
    }
    console.log(`[ramp] isolate ${first.isolate} baseline heap ${megabytes(first.heapBytes)}`)

    let lastGood = first
    for (let level = args.step; level <= args.max; level += args.step) {
      const result = await session.request(`/?ballast_mb=${level}&kb=1`)
      if (!result.ok) {
        console.log(
          `[ramp] DIED at ballast=${level}MB (${result.reason ?? result.status}); ` +
            `last good heap ${megabytes(lastGood.heapBytes)} at ballast=${lastGood.ballastMb ?? 0}MB`,
        )
        return
      }
      if (result.isolate !== first.isolate) {
        console.log(`[ramp] WARNING isolate changed ${first.isolate} -> ${result.isolate}`)
      }
      console.log(
        `[ramp] ballast=${String(level).padStart(3)}MB heap=${megabytes(result.heapBytes)} ` +
          `reported=${result.ballastMb}MB ${result.durationMs}ms`,
      )
      lastGood = result
    }
    console.log(`[ramp] survived to ballast=${args.max}MB, heap ${megabytes(lastGood.heapBytes)}`)
  })
}

/**
 * Steps the per-request payload upward at fixed concurrency until the isolate
 * stops answering, on one session so every step lands on the same isolate.
 */
async function measureThreshold(session, args, ballastMb) {
  // Ballast is re-asserted on every request rather than set once up front. A
  // measured fact makes that necessary: sequential requests stay on one isolate,
  // but the first *concurrent* batch forks onto a second one. Priming once would
  // therefore ballast an isolate that the batches never touch — which is exactly
  // how the first version of this experiment produced a flat, meaningless result.
  const ballastParam = `ballast_mb=${ballastMb}`

  // Two warm-up batches: the first pays for the fork and for allocating the
  // ballast, neither of which belongs in the measurement.
  for (let warmup = 0; warmup < 2; warmup += 1) {
    // eslint-disable-next-line no-await-in-loop -- warm-ups must not overlap
    await session.batch(`/?kb=1&${ballastParam}`, args.batch)
  }

  const check = await session.batch(`/?kb=1&${ballastParam}`, args.batch)
  const healthy = check.filter((response) => response.ok)
  if (healthy.length !== args.batch) {
    return { ballastMb, hungAtKb: null, reason: 'unhealthy before measurement' }
  }
  const wrongBallast = healthy.filter((response) => response.ballastMb !== ballastMb)
  if (wrongBallast.length > 0) {
    return { ballastMb, hungAtKb: null, reason: `ballast not applied on ${wrongBallast.length}` }
  }
  const isolates = [...new Set(healthy.map((response) => response.isolate))]
  const baselineHeap = Math.max(...healthy.map((response) => response.heapBytes ?? 0))
  console.log(
    `[threshold] ballast=${ballastMb}MB ready on ${isolates.length} isolate(s) ` +
      `${isolates.map((id) => id.slice(0, 8)).join(',')} heap=${megabytes(baselineHeap)}`,
  )

  let lastCleanKb = 0
  for (let kb = args.kbStep; kb <= args.kb; kb += args.kbStep) {
    // eslint-disable-next-line no-await-in-loop -- steps must not overlap
    const responses = await session.batch(`/?kb=${kb}&mode=build&${ballastParam}`, args.batch)
    const failed = responses.filter((response) => !response.ok).length
    const served = responses.filter((response) => response.ok)
    const heap = Math.max(0, ...served.map((response) => response.heapBytes ?? 0))
    const stillBallasted = served.every((response) => response.ballastMb === ballastMb)
    const batchIsolates = new Set(served.map((response) => response.isolate)).size
    console.log(
      `[threshold] ballast=${ballastMb}MB kb=${kb} batch=${args.batch} ` +
        `concurrent=${((kb * args.batch) / 1024).toFixed(1)}MB ` +
        `failed=${failed}/${args.batch} heap=${megabytes(heap)} ` +
        `isolates=${batchIsolates}${stillBallasted ? '' : ' BALLAST-LOST'}`,
    )
    if (failed > 0) {
      const reasons = responses
        .filter((response) => !response.ok)
        .map((response) => `${response.status}/${response.reason ?? '-'}@${response.durationMs}ms`)
      console.log(`[threshold]   failures: ${reasons.join('  ')}`)
      return {
        ballastMb,
        hungAtKb: kb,
        lastCleanKb,
        heapBytes: heap,
        isolates: batchIsolates,
        servedIsolate: served[0]?.isolate ?? null,
        reasons,
      }
    }
    lastCleanKb = kb
  }
  return { ballastMb, hungAtKb: null, lastCleanKb, heapBytes: baselineHeap }
}

async function commandThreshold(args) {
  await withSession(args.origin, async (session) => {
    const result = await measureThreshold(session, args, args.ballast)
    console.log(`[threshold] RESULT ${JSON.stringify(result)}`)
  })
}

/**
 * The discriminating experiment. Runs the same threshold sweep at several
 * ballast levels, each on a fresh session so a wedged isolate from one level
 * cannot contaminate the next.
 *
 *   response-bytes hypothesis -> threshold is flat across ballast levels
 *   isolate-memory hypothesis -> threshold falls by roughly the ballast added
 */
async function commandBallastEffect(args) {
  const levels = [0, 16, 32, 64]
  const results = []
  for (const level of levels) {
    for (let repeat = 0; repeat < args.repeats; repeat += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      const result = await withSession(args.origin, (session) =>
        measureThreshold(session, args, level),
      )
      results.push(result)
      console.log(`[ballast-effect] ${JSON.stringify(result)}`)
    }
  }
  console.log('\n[ballast-effect] SUMMARY')
  for (const result of results) {
    const concurrent = result.hungAtKb ? ((result.hungAtKb * args.batch) / 1024).toFixed(1) : '>max'
    console.log(
      `  ballast=${String(result.ballastMb).padStart(3)}MB  hung at ${concurrent}MB concurrent  ` +
        `(last clean ${((result.lastCleanKb * args.batch) / 1024).toFixed(1)}MB)`,
    )
  }
}

/**
 * Is the total concurrent byte count what matters, or the size of an individual
 * response? Holds `batch x kb` fixed and varies how it is split. A flat result
 * means the isolate has a budget for bytes in flight; a result that depends on
 * the split means the per-response path is what breaks.
 */
async function commandShape(args) {
  const totalKb = args.kb
  for (const batch of [1, 2, 4, 8, 16]) {
    const kb = Math.floor(totalKb / batch)
    if (kb < 1) continue
    // eslint-disable-next-line no-await-in-loop -- conditions must not overlap
    const outcome = await withSession(args.origin, async (session) => {
      await session.batch('/?kb=1', 2)
      const responses = await session.batch(`/?kb=${kb}&mode=build`, batch)
      const failed = responses.filter((response) => !response.ok).length
      return { failed, total: batch }
    })
    console.log(
      `[shape] total=${(totalKb / 1024).toFixed(1)}MB split ${String(batch).padStart(2)} x ` +
        `${String(kb).padStart(5)}KB -> failed ${outcome.failed}/${outcome.total}`,
    )
  }
}

/**
 * What exactly survives a wedge. Wedges one isolate deliberately, then watches
 * both the same connection and a fresh one, so "the damage persists" can be
 * checked against the alternative that only the connection was lost.
 */
async function commandAutopsy(args) {
  const victim = await new IsolateSession(args.origin).open()
  const before = await victim.request('/?kb=1')
  console.log(`[autopsy] pre-wedge isolate ${before.isolate} heap ${megabytes(before.heapBytes)}`)
  await victim.batch('/?kb=1', args.batch)

  const wedge = await victim.batch(`/?kb=${args.kb}&mode=build`, args.batch)
  const wedgeFailed = wedge.filter((response) => !response.ok)
  const wedgeServed = wedge.filter((response) => response.ok)
  console.log(
    `[autopsy] wedge attempt: ${wedgeFailed.length}/${args.batch} failed ` +
      `(${wedgeFailed.map((r) => r.reason ?? r.status).join(', ')}) ` +
      `served by ${[...new Set(wedgeServed.map((r) => r.isolate?.slice(0, 8)))].join(',') || 'none'}`,
  )
  if (wedgeFailed.length === 0) {
    console.log('[autopsy] nothing wedged; raise --kb or --batch')
    victim.close()
    return
  }

  for (let round = 0; round < 8; round += 1) {
    // eslint-disable-next-line no-await-in-loop -- observations are timed
    const same = await victim.request('/?kb=1')
    // eslint-disable-next-line no-await-in-loop -- observations are timed
    const fresh = await withSession(args.origin, (session) => session.request('/?kb=1'))
    console.log(
      `[autopsy] t+${round * 5}s  same-connection: ${same.ok ? `ok ${same.isolate?.slice(0, 8)} ${same.durationMs}ms` : `FAIL ${same.reason ?? same.status}`}` +
        `  |  new-connection: ${fresh.ok ? `ok ${fresh.isolate?.slice(0, 8)} ${fresh.durationMs}ms` : `FAIL ${fresh.reason ?? fresh.status}`}`,
    )
    // eslint-disable-next-line no-await-in-loop -- deliberate spacing
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  victim.close()
}

/**
 * Instantaneous dose. Each size gets a fresh connection, so nothing carries over
 * from the previous size. If large batches pass here but the same sizes fail
 * inside a ramp, the fault is cumulative exposure rather than peak load.
 */
async function commandSingleShot(args) {
  for (let kb = args.kbStep; kb <= args.kb; kb += args.kbStep) {
    // eslint-disable-next-line no-await-in-loop -- conditions must not overlap
    const outcome = await withSession(args.origin, async (session) => {
      // One small batch first, purely to trigger the fork onto the isolate that
      // will serve concurrent traffic, so the measured batch is not the one that
      // also pays for isolate start-up.
      const warm = await session.batch('/?kb=1', args.batch)
      const responses = await session.batch(`/?kb=${kb}&mode=build`, args.batch)
      return {
        warmOk: warm.every((response) => response.ok),
        failed: responses.filter((response) => !response.ok).length,
        heap: Math.max(0, ...responses.map((response) => response.heapBytes ?? 0)),
        isolate: responses.find((response) => response.isolate)?.isolate ?? null,
      }
    })
    console.log(
      `[single-shot] batch=${args.batch} kb=${kb} concurrent=${((kb * args.batch) / 1024).toFixed(1)}MB ` +
        `failed=${outcome.failed}/${args.batch} heap=${megabytes(outcome.heap)} ` +
        `isolate=${outcome.isolate?.slice(0, 8) ?? '-'}${outcome.warmOk ? '' : ' (warm-up already failed)'}`,
    )
  }
}

/**
 * Cumulative dose. One connection, one size, repeated until something breaks —
 * the count is then the isolate's tolerance at that size.
 */
async function commandCumulative(args) {
  const loadPath =
    args.path ?? `/?kb=${args.kb}&mode=${args.bytesMode ? 'bytes' : 'build'}${args.discard ? '&discard=1' : ''}`
  // The probe's own tiny endpoint does not exist on the real backend, so the
  // between-round health check has to be something the target actually serves.
  const smallPath = args.path ? '/health' : '/?kb=1'
  await withSession(args.origin, async (session) => {
    await session.batch(smallPath, args.batch)
    let servedBytes = 0
    // Rotation matters: a run that quietly moves to a second isolate spreads its
    // CPU across two budgets, which would look like tolerance that is not there.
    const isolatesSeen = new Map()
    for (let round = 1; round <= args.rounds; round += 1) {
      // eslint-disable-next-line no-await-in-loop -- rounds must not overlap
      const responses = await session.batch(loadPath, args.batch)
      const failed = responses.filter((response) => !response.ok).length
      servedBytes += responses.reduce((sum, response) => sum + (response.bytes ?? 0), 0)
      const heap = Math.max(0, ...responses.map((response) => response.heapBytes ?? 0))
      for (const response of responses) {
        if (response.isolate) {
          isolatesSeen.set(response.isolate, (isolatesSeen.get(response.isolate) ?? 0) + 1)
        }
      }
      if (args.gapMs > 0) {
        // eslint-disable-next-line no-await-in-loop -- the pause is the variable
        await new Promise((resolve) => setTimeout(resolve, args.gapMs))
      }
      if (failed > 0 || round % Math.max(1, Math.round(args.rounds / 12)) === 0) {
        console.log(
          `[cumulative] round=${round} failed=${failed}/${args.batch} ` +
            `served=${(servedBytes / 1048576).toFixed(0)}MB heap=${megabytes(heap)} ` +
              `isolates=${isolatesSeen.size}`,
        )
      }
      if (failed > 0) {
        const reasons = responses
          .filter((response) => !response.ok)
          .map((response) => `${response.status}/${response.reason ?? '-'}@${response.durationMs}ms`)
        console.log(`[cumulative]   failures: ${[...new Set(reasons)].join('  ')}`)
        console.log(
          `[cumulative]   isolates touched: ${[...isolatesSeen.entries()].map(([id, n]) => `${id.slice(0, 8)}x${n}`).join(' ')}`,
        )
        // The Cloudflare error code in the body distinguishes the failure modes
        // (1101 threw, 1102 exceeded resources, 1015 rate limited).
        const bodies = responses
          .filter((response) => !response.ok && response.body)
          .map((response) => response.body.replace(/\s+/g, ' ').slice(0, 200))
        for (const body of [...new Set(bodies)]) {
          console.log(`[cumulative]   body: ${body}`)
        }
        console.log(
          `[cumulative] RESULT broke on round ${round} at kb=${args.kb} batch=${args.batch}; ` +
            `${(servedBytes / 1048576).toFixed(0)}MB served in total`,
        )
        // Whether the isolate recovers decides the mitigation: a transient kill
        // needs a retry, a permanent wedge needs the load never to happen.
        for (let after = 1; after <= 4; after += 1) {
          // eslint-disable-next-line no-await-in-loop -- observations are timed
          const small = await session.batch(smallPath, args.batch)
          const smallFailed = small.filter((response) => !response.ok).length
          // eslint-disable-next-line no-await-in-loop -- observations are timed
          const repeat = await session.batch(loadPath, args.batch)
          // A fresh connection separates "this isolate is dead" from "this
          // connection is dead" — only the former is a service-wide problem.
          // eslint-disable-next-line no-await-in-loop -- observations are timed
          const fresh = await withSession(args.origin, (other) => other.request(smallPath))
          console.log(
            `[cumulative] after+${after}: small ${args.batch - smallFailed}/${args.batch} ok, ` +
              `same-size ${repeat.filter((r) => r.ok).length}/${args.batch} ok, ` +
              `fresh-connection ${fresh.ok ? `ok ${fresh.isolate?.slice(0, 8)} ${fresh.durationMs}ms` : `FAIL ${fresh.status}/${fresh.reason ?? '-'}`}`,
          )
        }
        return
      }
    }
    console.log(
      `[cumulative] RESULT survived ${args.rounds} rounds at kb=${args.kb} batch=${args.batch} ` +
        `(${(servedBytes / 1048576).toFixed(0)}MB served) across ${isolatesSeen.size} isolate(s): ` +
        `${[...isolatesSeen.entries()].map(([id, n]) => `${id.slice(0, 8)}x${n}`).join(' ')}`,
    )
  })
}

const COMMANDS = {
  heap: commandHeap,
  shape: commandShape,
  'single-shot': commandSingleShot,
  cumulative: commandCumulative,
  autopsy: commandAutopsy,
  'isolate-map': commandIsolateMap,
  'ramp-ballast': commandRampBallast,
  threshold: commandThreshold,
  'ballast-effect': commandBallastEffect,
}

const args = parseArgs(process.argv.slice(2))
if (args.auth) {
  sharedCookie = loadSessionCookie()
}
const command = COMMANDS[args.command]
if (!command) {
  console.error(`unknown command "${args.command}"; expected one of ${Object.keys(COMMANDS).join(', ')}`)
  process.exit(1)
}
command(args).catch((error) => {
  console.error(`[probe] failed: ${error.stack ?? error.message}`)
  process.exit(1)
})

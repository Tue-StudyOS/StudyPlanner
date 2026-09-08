/**
 * Tests intra-isolate concurrency, holding total request volume roughly fixed.
 *
 *   k6 run -e BATCH=1 -e VUS=8 ...   8 connections, 1 request in flight each
 *   k6 run -e BATCH=8 -e VUS=1 ...   1 connection, 8 requests in flight together
 *
 * Both send the same number of requests. The difference is whether they overlap
 * *inside one isolate*: a k6 VU reuses its own connection, connections pin to an
 * isolate (measured, docs/load-test-2026-08.md), and HTTP/2 multiplexes the
 * batch onto that one connection. So BATCH>1 puts concurrent tasks into a single
 * Python event loop, which is what the "Exception in callback
 * TaskStepMethWrapper" failure is about.
 *
 * If failures scale with BATCH rather than with connection count, the fault is
 * concurrency inside one isolate, not aggregate load.
 *
 * Reports which isolate served each response so a wedge can be attributed.
 */
import http from 'k6/http'
import { sleep } from 'k6'
import { Counter } from 'k6/metrics'

const ORIGIN = __ENV.PROBE_ORIGIN || 'https://studyplaner-api.ben-tischberger.workers.dev'
const BATCH = Number(__ENV.BATCH || '1')
const KB = __ENV.KB || '100'
const PATH = __ENV.PROBE_PATH || `/?kb=${KB}&mode=build`

const hung = new Counter('hung_requests')
const okCount = new Counter('ok_requests')

export const options = { summaryTrendStats: ['med', 'p(95)', 'max'] }

export default function run() {
  const requests = []
  for (let index = 0; index < BATCH; index += 1) {
    requests.push(['GET', `${ORIGIN}${PATH}`])
  }

  const responses = http.batch(requests)
  const isolates = new Set()
  for (const response of responses) {
    if (response.status >= 500 || response.status === 0) {
      hung.add(1)
    } else {
      okCount.add(1)
      const id = response.headers['X-Isolate-Id'] || response.headers['x-isolate-id']
      if (id) isolates.add(id)
    }
  }
  // Recorded so the "one connection == one isolate" premise can be checked
  // rather than assumed: a batch landing on >1 isolate would invalidate the test.
  if (isolates.size > 1) {
    console.warn(`[batch] vu=${__VU} batch spanned ${isolates.size} isolates`)
  }
  sleep(2 + Math.random() * 3)
}

export function handleSummary(data) {
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0)
  const total = count('hung_requests') + count('ok_requests')
  const pct = total ? ((count('hung_requests') / total) * 100).toFixed(2) : '0.00'
  const duration = data.metrics.http_req_duration.values
  return {
    stdout: `\nRESULT batch=${BATCH} vus=${__ENV.VUS || '?'} kb=${KB} requests=${total} hung=${count('hung_requests')} (${pct}%) med=${duration.med.toFixed(0)}ms max=${duration.max.toFixed(0)}ms\n`,
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, fetchJson, isRetryableFailure } from '../../src/shared/utils/api.ts'
import {
  reportClientErrorToServer,
  resetClientErrorReportBudget,
  shouldReportClientError,
} from '../../src/shared/utils/reportClientError.ts'

interface StubbedResponse {
  status: number
  body: string
}

/**
 * Counts only the request under test. Diagnostics posted to /api/client-errors
 * go through the same global fetch and would otherwise inflate the count.
 */
function stubFetch(responses: (StubbedResponse | Error)[]): { calls: number } {
  const state = { calls: 0 }
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('/api/client-errors')) {
      return { ok: true, status: 204, text: async () => '' } as Response
    }
    const next = responses[Math.min(state.calls, responses.length - 1)]
    state.calls += 1
    if (next instanceof Error) {
      throw next
    }
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      text: async () => next.body,
    } as Response
  }) as typeof fetch
  return state
}

test('isRetryableFailure retries safe methods on transport and server failures', () => {
  assert.equal(isRetryableFailure('GET', 0), true)
  assert.equal(isRetryableFailure('GET', 500), true)
  assert.equal(isRetryableFailure('GET', 503), true)
  assert.equal(isRetryableFailure('head', 502), true)
})

test('isRetryableFailure leaves client errors and unsafe methods alone', () => {
  assert.equal(isRetryableFailure('GET', 404), false)
  assert.equal(isRetryableFailure('GET', 429), false)
  // A POST that failed may still have been applied server-side.
  assert.equal(isRetryableFailure('POST', 500), false)
  assert.equal(isRetryableFailure('PUT', 0), false)
})

test('fetchJson recovers from a transient 500 without surfacing an error', async () => {
  const state = stubFetch([
    { status: 500, body: '<!DOCTYPE html>Worker threw' },
    { status: 200, body: '{"ok":true}' },
  ])

  const result = await fetchJson<{ ok: boolean }>('/api/config')

  assert.deepEqual(result, { ok: true })
  assert.equal(state.calls, 2)
})

test('fetchJson gives up after three attempts and throws the last failure', async () => {
  const state = stubFetch([{ status: 503, body: 'error code: 1101' }])

  await assert.rejects(
    () => fetchJson('/api/config'),
    (error: unknown) => error instanceof ApiError && error.status === 503,
  )
  assert.equal(state.calls, 3)
})

test('fetchJson does not retry a failed mutation', async () => {
  const state = stubFetch([{ status: 500, body: '{"error":"database_error"}' }])

  await assert.rejects(() => fetchJson('/api/me/favorites', { method: 'PUT' }))
  assert.equal(state.calls, 1)
})

test('shouldReportClientError skips statuses that are normal outcomes', () => {
  resetClientErrorReportBudget()

  // Every anonymous visitor's session check is a 401, and a 429 is the rate
  // limiter working as designed. Neither is a defect worth reporting.
  assert.equal(shouldReportClientError(401), false)
  assert.equal(shouldReportClientError(429), false)
  assert.equal(shouldReportClientError(500), true)
})

test('shouldReportClientError stops once the page budget is spent', () => {
  resetClientErrorReportBudget()
  stubFetch([{ status: 204, body: '' }])

  for (let index = 0; index < 10; index += 1) {
    reportClientErrorToServer({ method: 'GET', url: '/api/config', status: 500, message: 'x', pagePath: '/' })
  }

  assert.equal(shouldReportClientError(500), false)
})

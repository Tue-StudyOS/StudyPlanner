import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { ApiError, fetchJson } from '../../src/shared/utils/api.ts'
import { clearApiRequestLog, readApiRequestLog } from '../../src/shared/utils/apiRequestLog.ts'
import { resetClientErrorReportBudget } from '../../src/shared/utils/reportClientError.ts'

test('fetchJson correlates retry attempts and reports recovered errors', async (context) => {
  resetClientErrorReportBudget()
  clearApiRequestLog()
  const requestIds: string[] = []
  const reports: { detail: string }[] = []
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/client-errors')) {
      reports.push(JSON.parse(String(init?.body)))
      return new Response(null, { status: 204 })
    }
    const headers = new Headers(init?.headers)
    requestIds.push(headers.get('x-request-id') ?? '')
    assert.equal(headers.get('authorization'), 'Bearer private')
    return requestIds.length === 1
      ? new Response('<html><title>Error 1101</title>private</html>', { status: 500, headers: { 'cf-ray': 'ray-FRA' } })
      : new Response('{"ok":true}', { headers: { 'x-worker-version': 'version-1' } })
  })
  const result = await fetchJson('/api/config', { headers: { authorization: 'Bearer private' } })
  await setImmediate()
  assert.deepEqual(result, { ok: true })
  assert.equal(new Set(requestIds).size, 2)
  const failedEntry = readApiRequestLog().find(entry => entry.status === 500)
  assert.match(failedEntry?.detail ?? '', new RegExp(requestIds[0]))
  assert.match(failedEntry?.detail ?? '', /ray-FRA|1101/)
  assert.equal(reports.length, 1)
  assert.match(reports[0].detail, /Recovered on attempt: 2/)
  assert.doesNotMatch(JSON.stringify(readApiRequestLog()), /private/)
})

test('invalid success bodies are logged as invalid_json, not falsely recorded as OK', async (context) => {
  resetClientErrorReportBudget()
  clearApiRequestLog()
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    return String(input).includes('/api/client-errors')
      ? new Response(null, { status: 204 })
      : new Response('<html>private</html>', { headers: { 'content-type': 'text/html' } })
  })
  await assert.rejects(() => fetchJson('/api/config'), (error: unknown) => error instanceof ApiError && error.code === 'invalid_json')
  await setImmediate()
  assert.equal(readApiRequestLog()[0].code, 'invalid_json')
  assert.match(readApiRequestLog()[0].detail ?? '', /Request ID:|text\/html/)
  assert.doesNotMatch(JSON.stringify(readApiRequestLog()), /private/)
})

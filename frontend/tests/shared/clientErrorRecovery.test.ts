import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import {
  flushClientErrorReports,
  reportClientErrorToServer,
  resetClientErrorReportBudget,
} from '../../src/shared/utils/reportClientError.ts'

const payload = { method: 'GET', url: '/api/config?token=private', status: 500,
  message: 'Failure for ada@example.test', detail: 'Request ID: request-1\npassword="private value"' }

test('retains outage evidence when reporting fails and uploads it after recovery', async (context) => {
  resetClientErrorReportBudget()
  let healthy = false
  const reports: string[] = []
  context.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    reports.push(String(init?.body))
    return new Response(null, { status: healthy ? 204 : 503 })
  })
  reportClientErrorToServer(payload)
  await setImmediate()
  assert.equal(reports.length, 1)
  healthy = true
  await flushClientErrorReports()
  assert.equal(reports.length, 2)
  assert.equal(reports[0], reports[1])
  assert.doesNotMatch(reports[1], /private|ada@example.test/)
  assert.match(reports[1], /request-1/)
  await flushClientErrorReports()
  assert.equal(reports.length, 2)
})

test('report failures cannot form a storm and retries stop after three sends', async (context) => {
  resetClientErrorReportBudget()
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('offline') })
  reportClientErrorToServer(payload)
  await setImmediate()
  await flushClientErrorReports()
  await flushClientErrorReports()
  await flushClientErrorReports()
  assert.equal(calls, 3)
})

test('rejected reports are dropped rather than retried forever', async (context) => {
  resetClientErrorReportBudget()
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 400 }) })
  reportClientErrorToServer(payload)
  await setImmediate()
  await flushClientErrorReports()
  assert.equal(calls, 1)
})

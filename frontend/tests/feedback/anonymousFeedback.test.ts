import assert from 'node:assert/strict'
import test from 'node:test'
import { submitFeedback } from '../../src/features/feedback/api.ts'

test('feedback sends only the message and rating without credentials or a referrer', async (context) => {
  const calls: RequestInit[] = []
  context.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init: RequestInit) => {
    calls.push(init)
    return new Response('{}', { status: 201 })
  })
  await submitFeedback({ rating: 4, message: 'Helpful planner.' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].credentials, 'omit')
  assert.equal(calls[0].referrerPolicy, 'no-referrer')
  assert.deepEqual(calls[0].headers, { 'Content-Type': 'application/json' })
  assert.deepEqual(JSON.parse(String(calls[0].body)), { rating: 4, message: 'Helpful planner.' })
})

test('failed anonymous feedback does not send an authenticated diagnostic or retry', async (context) => {
  for (const failure of [429, 500, new Error('Network unavailable')]) {
    const calls: string[] = []
    context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      calls.push(String(input))
      if (failure instanceof Error) throw failure
      return new Response('{}', { status: failure })
    })
    await assert.rejects(submitFeedback({ rating: 4, message: 'Helpful planner.' }))
    assert.equal(calls.length, 1)
    assert.ok(calls[0].endsWith('/api/feedback'))
    context.mock.restoreAll()
  }
})

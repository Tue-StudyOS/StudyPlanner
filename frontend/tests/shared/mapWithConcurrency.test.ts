import assert from 'node:assert/strict'
import test from 'node:test'

import { mapWithConcurrency } from '../../src/shared/utils/mapWithConcurrency.ts'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

test('keeps results in input order regardless of completion order', async () => {
  const results = await mapWithConcurrency([10, 20, 30, 40], 2, async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value === 10 ? 20 : 1))
    return value * 2
  })

  assert.deepEqual(results, [20, 40, 60, 80])
})

test('never exceeds the concurrency limit', async () => {
  let inFlight = 0
  let peak = 0

  await mapWithConcurrency(Array.from({ length: 12 }, (_, index) => index), 3, async (value) => {
    inFlight += 1
    peak = Math.max(peak, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 2))
    inFlight -= 1
    return value
  })

  assert.equal(peak, 3)
})

test('the catalog case stays under the isolate threshold', async () => {
  // The regression this guards: seven ~1.43MB period fetches at once put ~10MB
  // of concurrent response bodies into one backend isolate and hung it. At a
  // limit of 2 the worst case is ~2.9MB, under the ~4MB measured threshold.
  let inFlight = 0
  let peak = 0
  const periodIds = ['226', '227', '228', '229', '233', '234', '235']

  await mapWithConcurrency(periodIds, 2, async (periodId) => {
    inFlight += 1
    peak = Math.max(peak, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 1))
    inFlight -= 1
    return periodId
  })

  const megabytesPerResponse = 1.43
  assert.ok(peak * megabytesPerResponse < 4, `peak ${peak} responses would exceed the threshold`)
})

test('runs sequentially when the limit is 1', async () => {
  const order: number[] = []
  const first = deferred<void>()

  const pending = mapWithConcurrency([1, 2], 1, async (value) => {
    order.push(value)
    if (value === 1) {
      await first.promise
    }
    return value
  })

  // The second item must not have started while the first is still pending.
  await Promise.resolve()
  assert.deepEqual(order, [1])
  first.resolve()
  await pending
  assert.deepEqual(order, [1, 2])
})

test('handles an empty input without spawning workers', async () => {
  const results = await mapWithConcurrency([], 4, async () => 'never')
  assert.deepEqual(results, [])
})

test('rejects a limit below one', async () => {
  await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), /at least 1/)
})

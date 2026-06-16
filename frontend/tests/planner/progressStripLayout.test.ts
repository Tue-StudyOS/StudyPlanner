import assert from 'node:assert/strict'
import test from 'node:test'
import { getBalancedColumnCount } from '../../src/features/planner/utils/progressStripLayout.ts'

test('keeps a single row when the count fits within the max', () => {
  assert.equal(getBalancedColumnCount(4), 4)
  assert.equal(getBalancedColumnCount(5), 5)
})

test('splits larger counts into balanced rows', () => {
  assert.equal(getBalancedColumnCount(6), 3) // 3 + 3
  assert.equal(getBalancedColumnCount(7), 4) // 4 + 3
  assert.equal(getBalancedColumnCount(8), 4) // 4 + 4
  assert.equal(getBalancedColumnCount(9), 5) // 5 + 4
  assert.equal(getBalancedColumnCount(10), 5) // 5 + 5
  assert.equal(getBalancedColumnCount(11), 4) // 4 + 4 + 3
})

test('respects a custom max column count', () => {
  assert.equal(getBalancedColumnCount(5, 4), 3) // 3 + 2
  assert.equal(getBalancedColumnCount(8, 4), 4) // 4 + 4
  assert.equal(getBalancedColumnCount(10, 4), 4) // 4 + 3 + 3
})

test('guards against empty or negative counts', () => {
  assert.equal(getBalancedColumnCount(0), 1)
  assert.equal(getBalancedColumnCount(1), 1)
  assert.equal(getBalancedColumnCount(-3), 1)
})

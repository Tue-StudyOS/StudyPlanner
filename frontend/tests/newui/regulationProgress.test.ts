import assert from 'node:assert/strict'
import test from 'node:test'
import { areaProgressPercent } from '../../src/features/newui/utils/regulationProgress.ts'

test('clamps the earned share to 0-100 and rounds', () => {
  assert.equal(areaProgressPercent(9, 18), 50)
  assert.equal(areaProgressPercent(24, 18), 100)
  assert.equal(areaProgressPercent(0, 30), 0)
})

test('returns 0 when nothing is required', () => {
  assert.equal(areaProgressPercent(6, 0), 0)
})

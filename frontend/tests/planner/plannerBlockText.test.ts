import assert from 'node:assert/strict'
import test from 'node:test'
import { getBlockTitleLineClamp } from '../../src/features/planner/utils/plannerBlockText.ts'

test('short blocks always keep at least one line', () => {
  assert.equal(getBlockTitleLineClamp(10, true), 1)
  assert.equal(getBlockTitleLineClamp(10, false), 1)
})

test('a 90-minute mobile block fits several small lines', () => {
  // 90 minutes at 56px/h = 84px.
  const lines = getBlockTitleLineClamp(84, true)
  assert.ok(lines >= 6, `expected >= 6 lines, got ${lines}`)
})

test('the minimum 38px block stays within bounds', () => {
  assert.equal(getBlockTitleLineClamp(38, true), 4)
  assert.equal(getBlockTitleLineClamp(38, false, true), 1)
  assert.equal(getBlockTitleLineClamp(38, false, false), 2)
})

test('desktop blocks reserve room for the type line', () => {
  const withType = getBlockTitleLineClamp(84, false, true)
  const withoutType = getBlockTitleLineClamp(84, false, false)
  assert.ok(withType < withoutType)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { getBlockTitleLineClamp } from '../../src/features/planner/utils/plannerBlockText.ts'

test('short blocks always keep at least one line', () => {
  assert.equal(getBlockTitleLineClamp(10, true), 1)
  assert.equal(getBlockTitleLineClamp(10, false), 1)
})

test('a 90-minute compact block fits seven 12px title lines', () => {
  // 90 minutes at 64px/h = 96px; compact cards reserve 4px of padding.
  assert.equal(getBlockTitleLineClamp(96, true), 7)
})

test('the minimum 44px block stays within bounds', () => {
  assert.equal(getBlockTitleLineClamp(44, true), 3)
  assert.equal(getBlockTitleLineClamp(44, false, true), 1)
  assert.equal(getBlockTitleLineClamp(44, false, false), 2)
})

test('desktop blocks reserve room for the type line', () => {
  const withType = getBlockTitleLineClamp(96, false, true)
  const withoutType = getBlockTitleLineClamp(96, false, false)
  assert.ok(withType < withoutType)
})

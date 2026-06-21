import assert from 'node:assert/strict'
import test from 'node:test'
import { isCourseOfferedInTerm } from '../../src/features/planner/utils/plannerOffering.ts'

test('summer-only courses are not offered in a winter term', () => {
  assert.equal(isCourseOfferedInTerm('summer', 'WS'), false)
  assert.equal(isCourseOfferedInTerm('summer', 'SS'), true)
})

test('winter-only courses are not offered in a summer term', () => {
  assert.equal(isCourseOfferedInTerm('winter', 'SS'), false)
  assert.equal(isCourseOfferedInTerm('winter', 'WS'), true)
})

test('both and unknown term types stay plannable in any term', () => {
  assert.equal(isCourseOfferedInTerm('both', 'SS'), true)
  assert.equal(isCourseOfferedInTerm('both', 'WS'), true)
  assert.equal(isCourseOfferedInTerm('unknown', 'SS'), true)
  assert.equal(isCourseOfferedInTerm(undefined, 'WS'), true)
})

test('missing active term never blocks a course', () => {
  assert.equal(isCourseOfferedInTerm('summer', null), true)
  assert.equal(isCourseOfferedInTerm('winter', null), true)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignCourseNumbers,
  getCourseColor,
} from '../../src/features/planner/utils/courseBadge.ts'

test('getCourseColor is deterministic and returns a palette hex', () => {
  const first = getCourseColor('INFM1234')
  assert.equal(first, getCourseColor('INFM1234'))
  assert.match(first, /^#[0-9a-f]{6}$/i)
})

test('assignCourseNumbers numbers in order and is stable for duplicates', () => {
  const numbers = assignCourseNumbers(['a', 'b', 'a', 'c'])
  assert.equal(numbers.get('a'), 1)
  assert.equal(numbers.get('b'), 2)
  assert.equal(numbers.get('c'), 3)
  assert.equal(numbers.size, 3)
})

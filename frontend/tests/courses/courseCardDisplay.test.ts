import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCourseCardTagOrder, getCompletedCourseCardVisibility } from '../../src/features/courses/utils/courseCardDisplay.ts'

test('buildCourseCardTagOrder keeps the season slot first and all other tags after it', () => {
  const order = buildCourseCardTagOrder({ types: ['Lecture'], masterCats: ['TECH', 'INFO'] })

  assert.equal(order.seasonFirst, true)
  assert.deepEqual(order.typeLabels, ['Lecture'])
  assert.deepEqual(order.categoryLabels, ['TECH', 'INFO'])
})

test('getCompletedCourseCardVisibility hides secondary details for completed cards', () => {
  assert.deepEqual(getCompletedCourseCardVisibility(true), {
    showTitle: true,
    showSeason: true,
    showEcts: true,
    showCompletedLabel: true,
    showSecondaryDetails: false,
  })
})

test('getCompletedCourseCardVisibility keeps details visible for regular cards', () => {
  assert.equal(getCompletedCourseCardVisibility(false).showSecondaryDetails, true)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { MasterCat, StudyAreaOption } from '../../src/features/courses/types.ts'
import {
  buildCourseAreaTags,
  buildCourseCardTagOrder,
  getCompletedCourseCardVisibility,
} from '../../src/features/courses/utils/courseCardDisplay.ts'

function option(programCode: string, studyAreaCode: string): StudyAreaOption {
  return {
    programCode,
    programName: null,
    studyAreaCode,
    studyAreaName: null,
    areaType: null,
    optionStatus: 'allowed',
    ectsCounted: null,
    moduleCode: null,
    moduleTitle: null,
  }
}

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

test('buildCourseAreaTags shows the active regulation areas instead of global categories', () => {
  const course = {
    masterCats: ['BASIS', 'INFO'] as MasterCat[],
    studyAreaOptions: [option('ML', 'ML-DIVERSE'), option('INF-BSC', 'TECH')],
  }
  assert.deepEqual(buildCourseAreaTags(course, 'ML'), [
    { key: 'ML-DIVERSE', label: 'DIVERSE', masterCat: 'BASIS' },
  ])
})

test('buildCourseAreaTags falls back to master categories without a selected program', () => {
  const course = { masterCats: ['TECH', 'INFO'] as MasterCat[], studyAreaOptions: [] }
  assert.deepEqual(buildCourseAreaTags(course, null), [
    { key: 'TECH', label: 'TECH', masterCat: 'TECH' },
    { key: 'INFO', label: 'INFO', masterCat: 'INFO' },
  ])
})

test('buildCourseAreaTags falls back when the course has no options for the program', () => {
  const course = { masterCats: ['THEO'] as MasterCat[], studyAreaOptions: [option('ML', 'ML-CS')] }
  assert.deepEqual(buildCourseAreaTags(course, 'INF-BSC'), [
    { key: 'THEO', label: 'THEO', masterCat: 'THEO' },
  ])
})

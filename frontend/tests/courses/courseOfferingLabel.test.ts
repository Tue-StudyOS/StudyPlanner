import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCourseSeasonIconTitle } from '../../src/features/courses/utils/courseOfferingLabel.ts'

const LABELS = {
  summer: 'Sommersemester',
  winter: 'Wintersemester',
  both: 'Sommer & Winter',
}

test('buildCourseSeasonIconTitle returns short term-type labels', () => {
  assert.equal(buildCourseSeasonIconTitle('summer', LABELS), 'Sommersemester')
  assert.equal(buildCourseSeasonIconTitle('winter', LABELS), 'Wintersemester')
  assert.equal(buildCourseSeasonIconTitle('both', LABELS), 'Sommer & Winter')
  assert.equal(buildCourseSeasonIconTitle('unknown', LABELS), undefined)
  assert.equal(buildCourseSeasonIconTitle(undefined, LABELS), undefined)
})

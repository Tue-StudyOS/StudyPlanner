import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCourseSeasonIconTitle } from '../../src/features/courses/utils/courseOfferingLabel.ts'

const LABELS = {
  summer: 'Sommersemester',
  winter: 'Wintersemester',
  both: 'Sommer- und Wintersemester',
}

test('buildCourseSeasonIconTitle returns semester-style term labels', () => {
  assert.equal(buildCourseSeasonIconTitle('summer', LABELS), 'Sommersemester')
  assert.equal(buildCourseSeasonIconTitle('winter', LABELS), 'Wintersemester')
  assert.equal(buildCourseSeasonIconTitle('both', LABELS), 'Sommer- und Wintersemester')
  assert.equal(buildCourseSeasonIconTitle('unknown', LABELS), undefined)
  assert.equal(buildCourseSeasonIconTitle(undefined, LABELS), undefined)
})

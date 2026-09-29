import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCustomCompletedCourse,
  parsePositiveEcts,
} from '../../src/features/transcript/utils/customCompletedCourse.ts'

test('parsePositiveEcts accepts decimal commas and rejects empty or non-positive values', () => {
  assert.equal(parsePositiveEcts('6'), 6)
  assert.equal(parsePositiveEcts(' 3,5 '), 3.5)
  assert.equal(parsePositiveEcts(''), null)
  assert.equal(parsePositiveEcts('0'), null)
  assert.equal(parsePositiveEcts('abc'), null)
})

test('buildCustomCompletedCourse stores an elective area without a catalog course', () => {
  const course = buildCustomCompletedCourse({
    title: '  Algorithms Abroad  ',
    ects: 6,
    externalCourseCode: '  AB-101  ',
    semester: ' WS 2024/25 ',
    grade: 1.7,
    studyAreaCode: 'INFO',
    masterCat: 'INFO',
  })

  assert.equal(course.courseId, null)
  assert.equal(course.title, 'Algorithms Abroad')
  assert.equal(course.ects, 6)
  assert.equal(course.externalCourseCode, 'AB-101')
  assert.equal(course.courseNumber, 'AB-101')
  assert.equal(course.studyAreaCode, 'INFO')
  assert.equal(course.masterCat, 'INFO')
  assert.equal(course.semester, 'WS 2024/25')
  assert.equal(course.source, 'manual')
  assert.match(course.id, /^manual-custom-algorithms abroad-/)
})

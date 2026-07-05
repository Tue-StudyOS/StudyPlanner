import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompletedCourse } from '../../src/features/courses/types.ts'
import {
  averageOfGrades,
  buildSemesterGroups,
  formatGrade,
} from '../../src/features/newui/utils/studyPlanOverview.ts'

function course(overrides: Partial<CompletedCourse> & Pick<CompletedCourse, 'id' | 'semester'>): CompletedCourse {
  return {
    title: 'Course',
    ects: 6,
    masterCat: 'INFO',
    grade: 2.0,
    ...overrides,
  }
}

test('groups completed courses by semester, newest first', () => {
  const groups = buildSemesterGroups(
    [
      course({ id: 'a', semester: 'SS 2025', ects: 6 }),
      course({ id: 'b', semester: 'WS 2024/25', ects: 3 }),
      course({ id: 'c', semester: 'SS 2025', ects: 6 }),
    ],
    'SS 2026',
  )

  assert.deepEqual(
    groups.map((group) => group.label),
    ['SS 2026', 'SS 2025', 'WS 2024/25'],
  )
  const ss2025 = groups.find((group) => group.label === 'SS 2025')
  assert.equal(ss2025?.courses.length, 2)
  assert.equal(ss2025?.totalEcts, 12)
})

test('always adds an open column for the current semester', () => {
  const groups = buildSemesterGroups([], 'SS 2026')
  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.label, 'SS 2026')
  assert.equal(groups[0]?.isOpen, true)
  assert.equal(groups[0]?.courses.length, 0)
})

test('marks current and future semesters as open, past as closed', () => {
  const groups = buildSemesterGroups(
    [course({ id: 'past', semester: 'SS 2025' }), course({ id: 'future', semester: 'SS 2027' })],
    'SS 2026',
  )
  assert.equal(groups.find((group) => group.label === 'SS 2025')?.isOpen, false)
  assert.equal(groups.find((group) => group.label === 'SS 2027')?.isOpen, true)
})

test('averageOfGrades ignores ungraded and uncounted courses', () => {
  const avg = averageOfGrades([
    course({ id: 'a', semester: 'SS 2025', grade: 1.0 }),
    course({ id: 'b', semester: 'SS 2025', grade: 3.0 }),
    course({ id: 'c', semester: 'SS 2025', grade: null }),
    course({ id: 'd', semester: 'SS 2025', grade: 5.0, isGradeCounted: false }),
  ])
  assert.equal(avg, 2.0)
  assert.equal(averageOfGrades([course({ id: 'x', semester: 'SS 2025', grade: null })]), null)
})

test('formatGrade renders one German decimal or a dash', () => {
  assert.equal(formatGrade(1.9), '1,9')
  assert.equal(formatGrade(2), '2,0')
  assert.equal(formatGrade(null), '–')
})

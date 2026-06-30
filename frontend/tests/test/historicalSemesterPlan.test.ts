import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course } from '../../src/features/courses/types.ts'
import { buildHistoricalSemesterPlan } from '../../src/features/planner/utils/historicalSemesterPlan.ts'

function course(overrides: Partial<Course> & Pick<Course, 'id' | 'number' | 'title'>): Course {
  return {
    id: overrides.id,
    number: overrides.number,
    title: overrides.title,
    lecturer: '',
    room: '',
    types: [],
    ects: null,
    sws: null,
    masterCats: [],
    weekdays: [],
    schedule: [],
    frequency: '',
    language: '',
    prerequisites: [],
    description: '',
    exams: [],
    ...overrides,
  }
}

test('buildHistoricalSemesterPlan maps completed courses in the selected semester to catalog courses', () => {
  const catalogCourses = [
    course({ id: 'course-a', number: 'INF-101', title: 'A', numericId: 101 }),
    course({ id: 'course-b', number: 'INF-102', title: 'B' }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      { courseId: 'course-a', courseNumber: 'INF-101', externalCourseCode: null, semester: 'WS 2023/24', studyAreaCode: 'MAIN' },
      { courseId: null, courseNumber: 'INF-102', externalCourseCode: null, semester: 'WS 2023/24', studyAreaCode: null },
      { courseId: 'course-a', courseNumber: 'INF-101', externalCourseCode: null, semester: 'SS 2024', studyAreaCode: 'OTHER' },
    ],
    catalogCourses,
    'WS 2023/24',
  )

  assert.deepEqual(plan.courses.map((matchedCourse) => matchedCourse.id), ['course-a', 'course-b'])
  assert.equal(plan.assignments['course-a'], 'MAIN')
  assert.equal(plan.matchedCompletedCourseCount, 2)
})

test('buildHistoricalSemesterPlan deduplicates repeated catalog matches and prefers catalog order from the supplied index', () => {
  const catalogCourses = [
    course({ id: 'old-period-course', number: 'INF-201', title: 'Old period' }),
    course({ id: 'new-period-course', number: 'INF-201', title: 'New period' }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      { courseId: null, courseNumber: 'INF-201', externalCourseCode: null, semester: 'SS 2023', studyAreaCode: 'TECH' },
      { courseId: null, courseNumber: 'INF-201', externalCourseCode: null, semester: 'SS 2023', studyAreaCode: 'TECH' },
    ],
    catalogCourses,
    'SS 2023',
  )

  assert.deepEqual(plan.courses.map((matchedCourse) => matchedCourse.id), ['old-period-course'])
  assert.equal(plan.matchedCompletedCourseCount, 2)
})

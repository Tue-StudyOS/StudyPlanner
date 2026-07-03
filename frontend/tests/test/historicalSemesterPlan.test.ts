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
    course({ id: 'course-a', number: 'INF-101', title: 'Algorithms I', numericId: 101 }),
    course({ id: 'course-b', number: 'INF-102', title: 'Data Structures', numericId: 102 }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      { courseId: 'course-a', courseNumber: 'INF-101', externalCourseCode: null, semester: 'WS 2023/24', studyAreaCode: 'MAIN', title: 'Algorithms I' },
      { courseId: null, courseNumber: 'INF-102', externalCourseCode: null, semester: 'WS 2023/24', studyAreaCode: null, title: 'Data Structures' },
      { courseId: 'course-a', courseNumber: 'INF-101', externalCourseCode: null, semester: 'SS 2024', studyAreaCode: 'OTHER', title: 'Algorithms I' },
    ],
    catalogCourses,
    'WS 2023/24',
  )

  assert.deepEqual(plan.courses.map((matchedCourse) => matchedCourse.id), ['course-a', 'course-b'])
  assert.equal(plan.assignments['course-a'], 'MAIN')
  assert.equal(plan.matchedCompletedCourseCount, 2)
})

test('buildHistoricalSemesterPlan keeps the newest catalog row for duplicate course numbers', () => {
  const catalogCourses = [
    course({ id: 'old-period-course', number: 'INF-201', title: 'Machine Learning' }),
    course({ id: 'new-period-course', number: 'INF-201', title: 'Machine Learning' }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      { courseId: null, courseNumber: 'INF-201', externalCourseCode: null, semester: 'SS 2023', studyAreaCode: 'TECH', title: 'Machine Learning' },
    ],
    catalogCourses,
    'SS 2023',
  )

  assert.deepEqual(plan.courses.map((matchedCourse) => matchedCourse.id), ['new-period-course'])
})

test('buildHistoricalSemesterPlan rejects numeric id matches that disagree with the course number', () => {
  const catalogCourses = [
    course({ id: 'course-a', number: 'INF-301', title: 'Security', numericId: 999 }),
    course({ id: '999', number: 'INF-999', title: 'Unrelated course', numericId: 999 }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      {
        courseId: '999',
        courseNumber: 'INF-301',
        externalCourseCode: null,
        semester: 'WS 2023/24',
        studyAreaCode: null,
        title: 'Security',
      },
    ],
    catalogCourses,
    'WS 2023/24',
  )

  assert.deepEqual(plan.courses.map((matchedCourse) => matchedCourse.id), ['course-a'])
})

test('buildHistoricalSemesterPlan rejects course numbers with mismatched titles', () => {
  const catalogCourses = [
    course({ id: 'course-a', number: 'INF-401', title: 'Computer Vision' }),
  ]

  const plan = buildHistoricalSemesterPlan(
    [
      {
        courseId: null,
        courseNumber: 'INF-401',
        externalCourseCode: null,
        semester: 'SS 2024',
        studyAreaCode: null,
        title: 'Operating Systems',
      },
    ],
    catalogCourses,
    'SS 2024',
  )

  assert.deepEqual(plan.courses, [])
})

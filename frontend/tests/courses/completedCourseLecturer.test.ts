import assert from 'node:assert/strict'
import test from 'node:test'
import type { CatalogPeriod, CompletedCourse, Course } from '../../src/features/courses/types.ts'
import {
  buildPeriodLecturerLookup,
  resolveCourseCardLecturerLabel,
  resolveHistoricalLecturerRaw,
} from '../../src/features/courses/utils/completedCourseLecturer.ts'
import { formatCourseLecturerName } from '../../src/features/courses/utils/lecturerName.ts'

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: '101',
    number: 'INF-101',
    title: 'Algorithms I',
    lecturer: 'Prof. Dr. Current Lecturer',
    types: ['Lecture'],
    ects: 6,
    masterCats: ['THEO'],
    schedule: [],
    exams: [],
    prerequisites: [],
    weekdays: [],
    frequency: '',
    language: '',
    description: '',
    room: '',
    ...overrides,
  }
}

function completed(overrides: Partial<CompletedCourse> = {}): CompletedCourse {
  return {
    id: 'done-1',
    title: 'Algorithms I',
    ects: 6,
    masterCat: 'THEO',
    grade: 1.3,
    semester: 'WS 2023/24',
    courseNumber: 'INF-101',
    ...overrides,
  }
}

const periods: CatalogPeriod[] = [
  { periodId: 'p2023w', label: 'Winter 2023/24', courseCount: 100 },
  { periodId: 'p2026s', label: 'Sommer 2026', courseCount: 100 },
]

test('formatCourseLecturerName joins multiple lecturers with commas', () => {
  assert.equal(
    formatCourseLecturerName({
      lecturer: '',
      lecturers: ['Prof. Dr. Anna Müller', 'Prof. Dr. Torsten Grust'],
    }),
    'Anna Müller, Torsten Grust',
  )
})

test('resolveCourseCardLecturerLabel prefers the lecturer from the completed semester', () => {
  const lookup = buildPeriodLecturerLookup('p2023w', [
    course({ id: '101', number: 'INF-101', lecturer: 'Prof. Dr. Historical Lecturer' }),
  ])

  const label = resolveCourseCardLecturerLabel(
    course({ lecturer: 'Prof. Dr. Current Lecturer' }),
    completed({ semester: 'WS 2023/24', courseNumber: 'INF-101' }),
    periods,
    lookup,
  )

  assert.equal(label, 'Historical Lecturer')
})

test('resolveHistoricalLecturerRaw matches by course number within the semester period', () => {
  const lookup = buildPeriodLecturerLookup('p2023w', [
    course({ id: '999', number: 'INF-101', lecturer: 'Prof. Dr. Historical Lecturer' }),
  ])

  const raw = resolveHistoricalLecturerRaw(
    course({ id: '101', number: 'INF-101' }),
    completed({ semester: 'WS 2023/24', courseNumber: 'INF-101' }),
    periods,
    lookup,
  )

  assert.equal(raw, 'Prof. Dr. Historical Lecturer')
})

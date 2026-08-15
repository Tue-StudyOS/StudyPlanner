import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompletedCourse, Course } from '../../src/features/courses/index.ts'
import type { SemesterPlanSummary } from '../../src/features/planner/types.ts'
import { buildSemesterCardStats } from '../../src/features/planner/utils/semesterCardStats.ts'

function createSummary(semesterLabel: string, courseCount: number): SemesterPlanSummary {
  return {
    semesterLabel,
    title: null,
    notes: null,
    courseCount,
    createdAtUnix: 1,
    updatedAtUnix: 1,
  }
}

function createCompletedCourse(
  id: string,
  semester: string,
  ects: number,
  studyAreaCode: string | null,
): CompletedCourse {
  return {
    id,
    title: id,
    ects,
    masterCat: 'INFO',
    studyAreaCode,
    grade: null,
    semester,
  }
}

function createCourse(id: string, ects: number): Course {
  return {
    id,
    number: `INF-${id}`,
    title: id,
    lecturer: '',
    room: '',
    types: [],
    ects,
    sws: null,
    masterCats: [],
    weekdays: [],
    schedule: [],
    frequency: '',
    language: 'German',
    prerequisites: [],
    description: '',
    exams: [],
  }
}

test('buildSemesterCardStats prefers completed courses over stale saved-plan summaries', () => {
  const stats = buildSemesterCardStats(
    'WS 2025/26',
    [createSummary('WS 2025/26', 1)],
    [
      createCompletedCourse('algorithms', 'WS 2025/26', 6, 'INFO-THEO'),
      createCompletedCourse('systems', 'WS 2025/26', 3, 'INFO-INFO'),
    ],
    [],
    {},
    {},
    'SS 2026',
  )

  assert.equal(stats.totalEcts, 9)
  assert.equal(stats.courseCount, 2)
  assert.deepEqual(
    stats.areaStats.map((area) => [area.areaCode, area.label, area.ects]),
    [
      ['INFO-THEO', 'THEO', 6],
      ['INFO-INFO', 'INFO', 3],
    ],
  )
})

test('buildSemesterCardStats uses loaded plan details for saved planned courses', () => {
  const stats = buildSemesterCardStats(
    'SS 2026',
    [createSummary('SS 2026', 1)],
    [],
    [createCourse('c1', 9), createCourse('c2', 6)],
    {},
    {
      'SS 2026': {
        courseIds: ['c1', 'c2'],
        courseAssignments: {
          c1: 'INFO-THEO',
          c2: 'INFO-INFO',
        },
      },
    },
    'SS 2026',
  )

  assert.equal(stats.totalEcts, 15)
  assert.equal(stats.courseCount, 2)
  assert.deepEqual(
    stats.areaStats.map((area) => [area.areaCode, area.label, area.ects]),
    [
      ['INFO-THEO', 'THEO', 9],
      ['INFO-INFO', 'INFO', 6],
    ],
  )
})

test('buildSemesterCardStats uses the current-semester plan even when the transcript has more rows', () => {
  const stats = buildSemesterCardStats(
    'SS 2026',
    [createSummary('SS 2026', 11)],
    [
      createCompletedCourse('old-a', 'SS 2026', 3, 'INFO-THEO'),
      createCompletedCourse('old-b', 'SS 2026', 3, 'INFO-THEO'),
      createCompletedCourse('old-c', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-d', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-e', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-f', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-g', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-h', 'SS 2026', 3, 'INFO-INFO'),
      createCompletedCourse('old-i', 'SS 2026', 2, 'INFO-INFO'),
      createCompletedCourse('old-j', 'SS 2026', 2, 'INFO-INFO'),
      createCompletedCourse('old-k', 'SS 2026', 2, 'INFO-INFO'),
    ],
    [createCourse('c1', 9), createCourse('c2', 6)],
    {},
    {
      'SS 2026': {
        courseIds: ['c1', 'c2'],
        courseAssignments: {
          c1: 'INFO-THEO',
          c2: 'INFO-INFO',
        },
      },
    },
    'SS 2026',
  )

  assert.equal(stats.totalEcts, 15)
  assert.equal(stats.courseCount, 2)
})

test('buildSemesterCardStats still prefers transcript rows for a past semester with a smaller saved plan', () => {
  const stats = buildSemesterCardStats(
    'WS 2025/26',
    [createSummary('WS 2025/26', 1)],
    [
      createCompletedCourse('algorithms', 'WS 2025/26', 6, 'INFO-THEO'),
      createCompletedCourse('systems', 'WS 2025/26', 3, 'INFO-INFO'),
    ],
    [createCourse('c1', 9)],
    {},
    {
      'WS 2025/26': {
        courseIds: ['c1'],
        courseAssignments: { c1: 'INFO-THEO' },
      },
    },
    'SS 2026',
  )

  assert.equal(stats.totalEcts, 9)
  assert.equal(stats.courseCount, 2)
})

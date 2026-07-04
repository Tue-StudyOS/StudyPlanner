import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course } from '../../src/features/courses/types.ts'
import { mergeCourseDetails } from '../../src/features/courses/utils/mergeCourseDetails.ts'

function baseCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    number: 'INF-001',
    title: 'Summary Title',
    lecturer: 'Prof. Summary',
    description: 'Summary description',
    schedule: [{ day: 'Mon', start: '10:00', end: '12:00', room: 'A', type: 'Course' }],
    contents: [{ title: 'Week 1', text: 'Intro', links: [] }],
    exams: [{ date: '2026-07-01', start: '10:00', end: '12:00', room: 'A', type: 'Klausur' }],
    prerequisites: ['Math'],
    studyAreaOptions: [{ programCode: 'INF', studyAreaCode: 'MAIN', studyAreaName: 'Main', moduleCode: 'M1', ectsCounted: 6 }],
    offeredPeriods: ['WS 25/26'],
    masterCats: ['MAIN'],
    externalLinks: [{ platform: 'ilias', url: 'https://example.com', label: 'Course' }],
    termType: 'winter',
    types: ['Lecture'],
    ects: 6,
    illias: null,
    descriptionLinks: [],
    ...overrides,
  }
}

test('mergeCourseDetails keeps summary fields when detail fetch is sparse', () => {
  const summary = baseCourse()
  const detail = baseCourse({
    title: '',
    lecturer: '',
    description: '',
    schedule: [],
    contents: [],
    exams: [],
    prerequisites: [],
    studyAreaOptions: [],
    offeredPeriods: [],
    masterCats: [],
    externalLinks: [],
    termType: 'unknown',
  })

  const merged = mergeCourseDetails(summary, detail)

  assert.equal(merged.title, 'Summary Title')
  assert.equal(merged.lecturer, 'Prof. Summary')
  assert.equal(merged.description, 'Summary description')
  assert.equal(merged.schedule.length, 1)
  assert.equal(merged.termType, 'winter')
})

test('mergeCourseDetails prefers richer detail values when present', () => {
  const summary = baseCourse({ description: 'Short' })
  const detail = baseCourse({
    description: 'Full ILIAS description',
    schedule: [{ day: 'Tue', start: '14:00', end: '16:00', room: 'B', type: 'Klausur' }],
  })

  const merged = mergeCourseDetails(summary, detail)

  assert.equal(merged.description, 'Full ILIAS description')
  assert.equal(merged.schedule[0]?.day, 'Tue')
})

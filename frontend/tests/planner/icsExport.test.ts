import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSemesterPlanIcs } from '../../src/features/planner/utils/icsExport.ts'
import type { Course } from '../../src/features/courses/types.ts'

function buildCourse(overrides: Partial<Course>): Course {
  return {
    id: '42',
    number: 'INFM1010',
    title: 'Machine Learning (Vorlesung)',
    lecturer: 'Prof. Dr. Example',
    room: 'A104',
    types: ['Vorlesung'],
    ects: 6,
    sws: 4,
    masterCats: [],
    weekdays: [],
    schedule: [
      { day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
      { day: 'Do.', time: '14:00 - 16:00', room: 'B201', type: 'Übung' },
    ],
    frequency: '',
    language: '',
    prerequisites: [],
    description: '',
    exams: [{ type: 'Klausur', date: '2026-07-28', duration: '90 min' }],
    ...overrides,
  }
}

test('builds weekly events inside the lecture period', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [buildCourse({})],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260413T100000/)
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260725T215959Z/)
  // The Thursday slot starts in the first lecture week as well.
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260416T140000/)
  // The title is cleaned and the slot type appended.
  assert.match(ics, /SUMMARY:Machine Learning \(Vorlesung\)/)
  assert.match(ics, /LOCATION:A104/)
})

test('skips hidden slots and unparseable times', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [
      buildCourse({
        schedule: [
          { day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
          { day: 'TBA', time: 'TBA', room: 'TBA', type: 'Vorlesung' },
        ],
      }),
    ],
    hiddenSlotIds: ['42:0'],
  })

  assert.ok(ics)
  assert.doesNotMatch(ics, /DTSTART;TZID/)
})

test('single-date schedule slots become one-off events instead of weekly ones', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [
      buildCourse({
        exams: [],
        schedule: [{ day: '28.07.2026', time: '10:00 - 12:00', room: 'Hörsaal 1', type: 'Vorlesung' }],
      }),
    ],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260728T100000/)
  assert.doesNotMatch(ics, /RRULE/)
})

test('exam dates become single all-day events', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [buildCourse({})],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /DTSTART;VALUE=DATE:20260728/)
  assert.match(ics, /SUMMARY:Machine Learning – Klausur/)
})

test('returns null for unparseable semester labels', () => {
  assert.equal(
    buildSemesterPlanIcs({ semesterLabel: 'nope', courses: [], hiddenSlotIds: [] }),
    null,
  )
})

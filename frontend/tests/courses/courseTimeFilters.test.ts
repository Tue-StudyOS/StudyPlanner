import assert from 'node:assert/strict'
import test from 'node:test'
import {
  courseMatchesTimeFilter,
  parseTimeInputToMinutes,
} from '../../src/features/courses/utils/courseTimeFilters.ts'

const COURSE = {
  schedule: [
    { day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
    { day: 'Do.', time: '14:00 - 16:00', room: 'B201', type: 'Übung' },
  ],
}

const NO_WINDOW = { startMinutes: null, endMinutes: null }

test('parseTimeInputToMinutes parses HH:MM inputs', () => {
  assert.equal(parseTimeInputToMinutes('08:30'), 510)
  assert.equal(parseTimeInputToMinutes('16:00'), 960)
  assert.equal(parseTimeInputToMinutes(''), null)
  assert.equal(parseTimeInputToMinutes('25:00'), null)
})

test('no active filter matches everything', () => {
  assert.equal(courseMatchesTimeFilter(COURSE, [], NO_WINDOW), true)
  assert.equal(courseMatchesTimeFilter({ schedule: [] }, [], NO_WINDOW), true)
})

test('day filter matches when any slot falls on a selected day', () => {
  assert.equal(courseMatchesTimeFilter(COURSE, ['Monday'], NO_WINDOW), true)
  assert.equal(courseMatchesTimeFilter(COURSE, ['Friday'], NO_WINDOW), false)
})

test('time window requires the slot to lie inside the window', () => {
  assert.equal(courseMatchesTimeFilter(COURSE, [], { startMinutes: 9 * 60, endMinutes: 13 * 60 }), true)
  assert.equal(courseMatchesTimeFilter(COURSE, [], { startMinutes: 11 * 60, endMinutes: null }), true)
  assert.equal(courseMatchesTimeFilter(COURSE, [], { startMinutes: 15 * 60, endMinutes: null }), false)
  assert.equal(courseMatchesTimeFilter(COURSE, [], { startMinutes: null, endMinutes: 11 * 60 }), false)
})

test('day and time filters combine on the same slot', () => {
  assert.equal(
    courseMatchesTimeFilter(COURSE, ['Monday'], { startMinutes: 9 * 60, endMinutes: 13 * 60 }),
    true,
  )
  assert.equal(
    courseMatchesTimeFilter(COURSE, ['Monday'], { startMinutes: 13 * 60, endMinutes: 17 * 60 }),
    false,
  )
})

test('courses without parseable slots never match active filters', () => {
  const unscheduledCourse = { schedule: [{ day: 'TBA', time: 'TBA', room: 'TBA', type: 'Vorlesung' }] }
  assert.equal(courseMatchesTimeFilter(unscheduledCourse, ['Monday'], NO_WINDOW), false)
  assert.equal(courseMatchesTimeFilter(unscheduledCourse, [], { startMinutes: 600, endMinutes: null }), false)
})

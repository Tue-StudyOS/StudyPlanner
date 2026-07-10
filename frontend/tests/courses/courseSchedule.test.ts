import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExamDisplayEntries,
  partitionCourseSchedule,
} from '../../src/features/courses/utils/courseSchedule.ts'

const schedule = [
  { day: '14.10.2025 - 03.02.2026', time: '14:00 - 16:00', room: 'N06', type: 'Vorlesung' },
  { day: '21.10.2025 - 03.02.2026', time: '08:00 - 10:00', room: 'C9', type: 'Übung', groupTitle: 'Tutorium A' },
  { day: '10.02.2026', time: '15:00 - 18:00', room: 'N02', type: 'Klausur' },
  { day: '18.02.2026', time: '08:00 - 18:00', room: 'A104', type: 'Klausurkorrektur', calendarRelevant: false },
]

test('partitionCourseSchedule separates lectures, tutorials, exams, and administrative dates', () => {
  const parts = partitionCourseSchedule(schedule)
  assert.equal(parts.recurringSessions.length, 1)
  assert.equal(parts.tutorialOptions.length, 1)
  assert.equal(parts.examAppointments.length, 1)
  assert.equal(parts.otherAppointments.length, 1)
})

test('buildExamDisplayEntries prefers timed appointment data over duplicate all-day dates', () => {
  const parts = partitionCourseSchedule(schedule)
  const exams = buildExamDisplayEntries(parts.examAppointments, [
    { type: 'Klausur', date: '2026-02-10', duration: '' },
    { type: 'Nachklausur', date: '2026-04-07', duration: '' },
  ])

  assert.equal(exams.length, 2)
  assert.equal(exams[0]?.time, '15:00 - 18:00')
  assert.equal(exams[1]?.date, '2026-04-07')
})

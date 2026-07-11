import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExamDisplayEntries,
  buildScheduleSlotSecondaryDetails,
  formatCancellationDates,
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

test('buildScheduleSlotSecondaryDetails omits redundant ALMA group titles', () => {
  assert.deepEqual(
    buildScheduleSlotSecondaryDetails({
      day: '17.04.2026 - 24.07.2026',
      time: '10:00 - 12:00',
      room: 'N15',
      type: 'Übung',
      groupTitle: 'Mathematik für Informatik 4: Stochastik (Übung) (2. Parallelgruppe)',
      timeNote: null,
      note: 'Bring exercise sheet',
    }),
    ['Bring exercise sheet'],
  )
})

test('buildExamDisplayEntries merges same exam appointments that only differ by room', () => {
  const examSchedule = [
    { day: '27.05.2026', time: '10:00 - 12:00', room: 'C423', type: 'Klausur' },
    { day: '2026-05-27', time: '10:00 - 12:00', room: 'N06', type: 'Klausur' },
    { day: '27.05.2026', time: '14:00 - 16:00', room: 'C423', type: 'Klausur' },
  ]
  const parts = partitionCourseSchedule(examSchedule)
  const exams = buildExamDisplayEntries(parts.examAppointments, [])

  assert.equal(exams.length, 2)
  assert.equal(exams[0]?.room, 'C423 · N06')
  assert.equal(exams[1]?.time, '14:00 - 16:00')
})

test('formatCancellationDates presents cancellation days in the active language', () => {
  assert.equal(formatCancellationDates(['2026-05-27'], 'de'), '27.05.2026')
  assert.equal(formatCancellationDates(['2026-05-27'], 'en'), '27 May 2026')
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

import assert from 'node:assert/strict'
import test from 'node:test'

import { getScheduleSlotKind, getScheduleSlotTypeLabel } from '../../src/features/courses/utils/scheduleSlotKind.ts'

test('classifies recurring date ranges as weekly slots', () => {
  assert.equal(
    getScheduleSlotKind({
      day: '13.04.2026 - 20.07.2026',
      time: '10:00 - 12:00',
      room: 'Hörsaal N06',
      type: 'Vorlesung',
    }),
    'weekly',
  )
})

test('classifies German and English exam slot types', () => {
  assert.equal(
    getScheduleSlotKind({
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hörsaal N02',
      type: 'Klausur',
    }),
    'exam',
  )
  assert.equal(
    getScheduleSlotKind({
      day: '2026-07-27',
      time: '08:00 - 11:00',
      room: 'Lecture hall',
      type: 'Exam',
    }),
    'exam',
  )
})

test('classifies German and English resit exam slot types', () => {
  assert.equal(
    getScheduleSlotKind({
      day: '29.09.2026',
      time: '09:00 - 12:00',
      room: 'Hörsaal 25',
      type: 'Nachklausur',
    }),
    'resit',
  )
  assert.equal(
    getScheduleSlotKind({
      day: '2026-09-29',
      time: '09:00 - 12:00',
      room: 'Lecture hall',
      type: 'Resit exam',
    }),
    'resit',
  )
})

test('keeps one-off lecture sessions off the exam styling path', () => {
  assert.equal(
    getScheduleSlotKind({
      day: '04.08.2026',
      time: '08:00 - 12:00',
      room: 'Seminarraum C215',
      type: 'Vorlesung/Übung',
    }),
    'weekly',
  )
})

test('labels exams explicitly even when ALMA also carries a session type', () => {
  assert.equal(
    getScheduleSlotTypeLabel({
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hörsaal N02',
      type: 'Klausur',
    }),
    'Klausur',
  )
  assert.equal(
    getScheduleSlotTypeLabel({
      day: '04.08.2026',
      time: '08:00 - 12:00',
      room: 'Seminarraum C215',
      type: 'Vorlesung/Übung',
    }),
    'Vorlesung/Übung',
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseExam } from '../../src/features/courses/types.ts'
import { getDateOrdinal, getExamDateOrdinal, getExamDisplayLabel } from '../../src/features/courses/utils/examLabels.ts'

function exam(date: string): CourseExam {
  return { type: 'Exam', date, duration: '90 min' }
}

test('getExamDisplayLabel labels a single exam as exam', () => {
  assert.equal(getExamDisplayLabel([exam('10.02.2026')], 0, 'en'), 'Exam')
  assert.equal(getExamDisplayLabel([exam('10.02.2026')], 0, 'de'), 'Klausur')
})

test('getExamDisplayLabel labels the next distinct date as resit exam', () => {
  const exams = [exam('10.02.2026'), exam('24.03.2026')]
  assert.equal(getExamDisplayLabel(exams, 0, 'en'), 'Exam')
  assert.equal(getExamDisplayLabel(exams, 1, 'en'), 'Resit exam')
  assert.equal(getExamDisplayLabel(exams, 1, 'de'), 'Nachklausur')
})

test('getExamDateOrdinal treats same-date room entries as the same exam date', () => {
  const exams = [exam('10.02.2026'), exam('10.02.2026'), exam('24.03.2026')]
  assert.equal(getExamDateOrdinal(exams, 0), 0)
  assert.equal(getExamDateOrdinal(exams, 1), 0)
  assert.equal(getExamDateOrdinal(exams, 2), 1)
})

test('getExamDisplayLabel uses the date count for more than two entries', () => {
  const exams = [exam('10.02.2026'), exam('10.02.2026'), exam('24.03.2026'), exam('24.03.2026')]
  assert.equal(getExamDisplayLabel(exams, 3, 'en'), 'Resit exam')
})

test('getExamDisplayLabel uses chronological date order even when entries are unsorted', () => {
  const exams = [exam('24.03.2026'), exam('10.02.2026'), exam('05.04.2026')]
  assert.equal(getExamDisplayLabel(exams, 0, 'en'), 'Resit exam')
  assert.equal(getExamDisplayLabel(exams, 1, 'en'), 'Exam')
  assert.equal(getExamDateOrdinal(exams, 2), 2)
})

test('getDateOrdinal works on raw schedule date strings', () => {
  const dates = ['24.03.2026', '10.02.2026']
  assert.equal(getDateOrdinal(dates, 0), 1)
  assert.equal(getDateOrdinal(dates, 1), 0)
})

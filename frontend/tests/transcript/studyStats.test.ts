import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeStudyStats } from '../../src/features/transcript/utils/studyStats.ts'

type Course = { ects: number; grade: number | null; studyAreaCode?: string | null }

function course(ects: number, grade: number | null, studyAreaCode?: string | null): Course {
  return { ects, grade, studyAreaCode }
}

test('sums earned ECTS and rounds progress against required ECTS', () => {
  const stats = computeStudyStats([course(6, 2.0), course(9, 1.0)], 180)
  assert.equal(stats.totalEcts, 15)
  assert.equal(stats.requiredEcts, 180)
  assert.equal(stats.progress, Math.round((15 / 180) * 100))
})

test('grade average is ECTS-weighted, not a plain mean', () => {
  // Plain mean would be 2.0; weighted by ECTS it leans toward the 9 ECTS course.
  const stats = computeStudyStats([course(3, 3.0), course(9, 1.0)], 180)
  const expected = (3 * 3.0 + 9 * 1.0) / (3 + 9)
  assert.equal(stats.averageGrade, expected)
})

test('excludes overarching-competence (UEBK) modules from the grade, case-insensitively', () => {
  const withUebk = computeStudyStats(
    [course(6, 1.0, 'INFO'), course(6, 4.0, 'uebk')],
    180,
  )
  assert.equal(withUebk.averageGrade, 1.0)
})

test('UEBK ECTS still count toward the total even though they skip the grade', () => {
  const stats = computeStudyStats([course(6, 1.0, 'INFO'), course(6, 4.0, 'UEBK')], 180)
  assert.equal(stats.totalEcts, 12)
})

test('returns null average when there are no graded courses', () => {
  const stats = computeStudyStats([course(6, null, 'INFO')], 180)
  assert.equal(stats.averageGrade, null)
})

test('falls back to an unweighted mean when graded courses carry no ECTS', () => {
  const stats = computeStudyStats([course(0, 2.0, 'INFO'), course(0, 4.0, 'INFO')], 180)
  assert.equal(stats.averageGrade, 3.0)
})

test('progress is zero when required ECTS is zero', () => {
  const stats = computeStudyStats([course(6, 2.0)], 0)
  assert.equal(stats.progress, 0)
})

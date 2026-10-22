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

test('does not hardcode UEBK grade exclusion in the fallback', () => {
  const withUebk = computeStudyStats(
    [course(6, 1.0, 'INFO'), course(6, 4.0, 'uebk')],
    180,
  )
  assert.equal(withUebk.averageGrade, 2.5)
})

test('UEBK ECTS still count toward the total even though they skip the grade', () => {
  const stats = computeStudyStats([course(6, 1.0, 'INFO'), course(6, 4.0, 'UEBK')], 180)
  assert.equal(stats.totalEcts, 12)
})

test('prefers official degree and grade allocations over raw course ECTS', () => {
  const stats = computeStudyStats([{
    ects: 9,
    grade: 1.66,
    gradeUsedForAverage: 1.66,
    degreeCountedEcts: 6,
    gradeCountedEcts: 4,
    isGradeCounted: true,
    studyAreaCode: 'ML-CS',
  }], 120)
  assert.equal(stats.totalEcts, 6)
  assert.equal(stats.averageGrade, 1.6)
})

test('returns null average when there are no graded courses', () => {
  const stats = computeStudyStats([course(6, null, 'INFO')], 180)
  assert.equal(stats.averageGrade, null)
})

test('returns null rather than an unweighted mean when grade-counted weight is zero', () => {
  const stats = computeStudyStats([course(0, 2.0, 'INFO'), course(0, 4.0, 'INFO')], 180)
  assert.equal(stats.averageGrade, null)
})

test('authoritative grade allocation outranks review flags and progress is capped', () => {
  const stats = computeStudyStats([{
    ects: 9, grade: 1.66, gradeUsedForAverage: 1.66, degreeCountedEcts: 9,
    gradeCountedEcts: 9, isGradeCounted: true, assignmentNeedsReview: true,
  }], 6)
  assert.equal(stats.averageGrade, 1.6)
  assert.equal(stats.progress, 100)
})

test('authoritative zero grade weight never falls back to raw workload', () => {
  const stats = computeStudyStats([{
    ects: 9, grade: 1.66, gradeUsedForAverage: null, degreeCountedEcts: 9,
    gradeCountedEcts: 0, isGradeCounted: false,
  }], 120)
  assert.equal(stats.averageGrade, null)
})

test('progress is zero when required ECTS is zero', () => {
  const stats = computeStudyStats([course(6, 2.0)], 0)
  assert.equal(stats.progress, 0)
})

test('assignments awaiting compulsory-area review do not silently affect the grade average', () => {
  const stats = computeStudyStats([
    { ects: 9, grade: 1, studyAreaCode: 'INFO', assignmentNeedsReview: true },
    { ects: 6, grade: 2, studyAreaCode: 'INF' },
  ], 180)
  assert.equal(stats.totalEcts, 15)
  assert.equal(stats.averageGrade, 2)
})

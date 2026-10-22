import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatOptionalTranscriptGrade, isValidTranscriptGrade, truncateDegreeGrade } from '../../src/features/transcript/utils/grades.ts'

test('accepts finite module grades from 1 to 4 with at most two decimals', () => {
  for (const value of [1, 1.66, 2.03, 4]) assert.equal(isValidTranscriptGrade(value), true)
  for (const value of [0.99, 4.01, 1.666, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(isValidTranscriptGrade(value), false)
})

test('preserves module grade precision and truncates final grade to one decimal', () => {
  assert.equal(formatOptionalTranscriptGrade(1.66), '1.66')
  assert.equal(truncateDegreeGrade(1.66), 1.6)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { isTranscriptImportedCourse } from '../../src/features/transcript/utils/completedCourseKeys.ts'

test('isTranscriptImportedCourse recognizes current and legacy transcript records', () => {
  assert.equal(isTranscriptImportedCourse({ id: 'stored-1', source: 'transcript_import' }), true)
  assert.equal(isTranscriptImportedCourse({ id: 'stored-2', source: 'transcript' }), true)
  assert.equal(isTranscriptImportedCourse({ id: 'import-old-entry' }), true)
  assert.equal(isTranscriptImportedCourse({ id: 'transcript-old-entry', source: 'manual' }), true)
})

test('isTranscriptImportedCourse preserves manual and planner-completed records', () => {
  assert.equal(isTranscriptImportedCourse({ id: 'manual-course', source: 'manual' }), false)
  assert.equal(isTranscriptImportedCourse({ id: 'planner-course', source: 'planner_completion' }), false)
})

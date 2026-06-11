import assert from 'node:assert/strict'
import test from 'node:test'
import type { SavedTranscriptIssue, TranscriptImportCandidate } from '../../src/features/transcript/types.ts'
import {
  buildFailedImportCandidate,
  buildImportNotice,
  buildReviewCandidateKey,
  mergeIssues,
  mergeReviewCandidates,
  toImportedCompletedCourse,
} from '../../src/features/transcript/utils/transcriptReview.ts'

function createCandidate(overrides: Partial<TranscriptImportCandidate> & { id: string }): TranscriptImportCandidate {
  return {
    sourcePage: 1,
    sourceSection: null,
    rawText: `raw ${overrides.id}`,
    extractedTitle: overrides.id,
    titleCandidates: [overrides.id],
    title: overrides.id,
    semester: 'WS 2024/25',
    grade: 1.7,
    extractedEcts: 6,
    ects: 6,
    masterCat: 'INFO',
    studyAreaCode: null,
    status: 'unmatched',
    statusDetail: '',
    parseIssues: [],
    validationIssues: [],
    matchOptions: [],
    matchedCourse: null,
    courseId: null,
    courseNumber: null,
    isUserEdited: false,
    ...overrides,
  }
}

function createIssue(id: string, updatedAtUnix: number): SavedTranscriptIssue {
  return { id, candidate: createCandidate({ id }), updatedAtUnix }
}

function createRow(id: string, title: string): TranscriptImportCandidate {
  return createCandidate({
    id,
    title,
    extractedTitle: title,
    titleCandidates: [title],
    rawText: `raw ${title}`,
  })
}

test('mergeReviewCandidates skips rows already known in review or saved issues', () => {
  const existing = createRow('existing', 'Algorithms')
  const savedIssue = createRow('issue', 'Databases')
  const duplicateOfExisting = createRow('dup-1', 'Algorithms')
  const duplicateOfIssue = createRow('dup-2', 'Databases')
  const fresh = createRow('fresh', 'Compilers')

  const result = mergeReviewCandidates(
    [existing],
    [duplicateOfExisting, duplicateOfIssue, fresh],
    [savedIssue],
  )

  assert.equal(result.addedCount, 1)
  assert.equal(result.duplicateCount, 2)
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ['existing', 'fresh'])
})

test('buildReviewCandidateKey treats differing grades as distinct rows', () => {
  const passed = createCandidate({ id: 'a', grade: 1.7 })
  const ungraded = createCandidate({ id: 'b', grade: null })

  assert.notEqual(buildReviewCandidateKey(passed), buildReviewCandidateKey(ungraded))
})

test('mergeIssues replaces matching ids and sorts newest first', () => {
  const existing = [createIssue('old', 1000), createIssue('stable', 2000)]
  const updated = createCandidate({ id: 'old', title: 'Updated title' })

  const merged = mergeIssues(existing, [updated])

  assert.deepEqual(merged.map((issue) => issue.id), ['old', 'stable'])
  assert.equal(merged[0].candidate.title, 'Updated title')
  assert.ok(merged[0].updatedAtUnix >= merged[1].updatedAtUnix)
})

test('buildImportNotice mentions duplicates and unresolved rows', () => {
  assert.equal(
    buildImportNotice({ importedCount: 3, skippedDuplicateCount: 0, unresolvedCount: 0, issueSyncFailed: false }),
    'Imported 3 course(s).',
  )
  assert.equal(
    buildImportNotice({ importedCount: 1, skippedDuplicateCount: 2, unresolvedCount: 1, issueSyncFailed: false }),
    'Imported 1 course(s) · 2 duplicate row(s) already existed · 1 row(s) still need attention and were saved for later.',
  )
  assert.equal(
    buildImportNotice({ importedCount: 0, skippedDuplicateCount: 0, unresolvedCount: 0, issueSyncFailed: true }),
    'Imported 0 course(s) · the follow-up issue sync could not be completed right now.',
  )
})

test('buildFailedImportCandidate appends the error and re-validates the row', () => {
  const candidate = createCandidate({ id: 'failed' })

  const failed = buildFailedImportCandidate(candidate, 'Server rejected this row.')

  assert.ok(failed.parseIssues.includes('Server rejected this row.'))
  assert.equal(failed.status, 'invalid')
  assert.equal(failed.isUserEdited, true)
})

test('toImportedCompletedCourse prefers matched course data', () => {
  const candidate = createCandidate({
    id: 'imported',
    title: 'Extracted Title',
    courseId: 'course-9',
    courseNumber: 'INF9000',
    matchedCourse: {
      id: 'course-9',
      number: 'INF9000',
      title: 'Catalog Title',
      ects: 9,
      masterCats: ['PRAK'],
      studyAreaOptions: undefined,
      regulationAreaCodes: [],
    },
  })

  const completed = toImportedCompletedCourse(candidate)

  assert.equal(completed.id, 'import-imported')
  assert.equal(completed.courseId, 'course-9')
  assert.equal(completed.title, 'Catalog Title')
  assert.equal(completed.source, 'transcript_import')
})

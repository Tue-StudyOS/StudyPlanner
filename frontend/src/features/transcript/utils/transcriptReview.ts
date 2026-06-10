import type { CompletedCourse } from '../../courses'
import type { SavedTranscriptIssue, TranscriptImportCandidate } from '../types.ts'
import { updateTranscriptImportCandidate } from './buildTranscriptImportCandidates.ts'

export function toImportedCompletedCourse(candidate: TranscriptImportCandidate): CompletedCourse {
  return {
    id: `import-${candidate.id}`,
    courseId: candidate.courseId,
    courseNumber: candidate.courseNumber ?? undefined,
    externalCourseCode: candidate.courseNumber ?? undefined,
    title: candidate.matchedCourse?.title ?? candidate.title,
    ects: candidate.ects ?? 0,
    masterCat: candidate.masterCat,
    studyAreaCode: candidate.studyAreaCode,
    grade: candidate.grade,
    semester: candidate.semester,
    source: 'transcript_import',
  }
}

// Re-runs validation so issues stored with an older app version pick up the
// current status and validation rules when they are loaded again.
export function toSavedIssue(issue: SavedTranscriptIssue): SavedTranscriptIssue {
  return {
    ...issue,
    candidate: updateTranscriptImportCandidate(issue.candidate, {}),
  }
}

export function toSavedIssuePayload(candidate: TranscriptImportCandidate): SavedTranscriptIssue {
  return {
    id: candidate.id,
    candidate,
    updatedAtUnix: Date.now(),
  }
}

export function mergeIssues(
  existingIssues: SavedTranscriptIssue[],
  nextCandidates: TranscriptImportCandidate[],
): SavedTranscriptIssue[] {
  const mergedById = new Map(existingIssues.map((issue) => [issue.id, issue]))
  nextCandidates.forEach((candidate) => {
    mergedById.set(candidate.id, toSavedIssuePayload(candidate))
  })
  return [...mergedById.values()].sort((left, right) => right.updatedAtUnix - left.updatedAtUnix)
}

export function buildFailedImportCandidate(
  candidate: TranscriptImportCandidate,
  errorMessage: string,
): TranscriptImportCandidate {
  return updateTranscriptImportCandidate(candidate, {
    parseIssues: [...candidate.parseIssues, errorMessage],
  })
}

export function buildImportNotice(params: {
  importedCount: number
  skippedDuplicateCount: number
  unresolvedCount: number
  issueSyncFailed: boolean
}): string {
  const messageParts = [`Imported ${params.importedCount} course(s)`]
  if (params.skippedDuplicateCount > 0) {
    messageParts.push(`${params.skippedDuplicateCount} duplicate row(s) already existed`)
  }
  if (params.unresolvedCount > 0) {
    messageParts.push(
      params.issueSyncFailed
        ? `${params.unresolvedCount} row(s) still need attention and stayed on this page`
        : `${params.unresolvedCount} row(s) still need attention and were saved for later`,
    )
  } else if (params.issueSyncFailed) {
    messageParts.push('the follow-up issue sync could not be completed right now')
  }
  return `${messageParts.join(' · ')}.`
}

function normalizeReviewCandidatePart(value: number | string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function buildReviewCandidateKey(candidate: TranscriptImportCandidate): string {
  return [
    candidate.courseId,
    candidate.courseNumber,
    candidate.matchedCourse?.number,
    candidate.extractedTitle,
    candidate.title,
    candidate.semester,
    candidate.grade === null ? 'no-grade' : candidate.grade.toFixed(1),
    candidate.ects,
    candidate.rawText,
  ]
    .map((value) => normalizeReviewCandidatePart(value))
    .join('::')
}

export function mergeReviewCandidates(
  existingCandidates: TranscriptImportCandidate[],
  nextCandidates: TranscriptImportCandidate[],
  additionalKnownCandidates: TranscriptImportCandidate[] = [],
): {
  candidates: TranscriptImportCandidate[]
  addedCount: number
  duplicateCount: number
} {
  const knownKeys = new Set(
    [...existingCandidates, ...additionalKnownCandidates].map((candidate) => buildReviewCandidateKey(candidate)),
  )
  const candidates = [...existingCandidates]
  let addedCount = 0
  let duplicateCount = 0

  nextCandidates.forEach((candidate) => {
    const reviewKey = buildReviewCandidateKey(candidate)
    if (knownKeys.has(reviewKey)) {
      duplicateCount += 1
      return
    }

    knownKeys.add(reviewKey)
    candidates.push(candidate)
    addedCount += 1
  })

  return { candidates, addedCount, duplicateCount }
}

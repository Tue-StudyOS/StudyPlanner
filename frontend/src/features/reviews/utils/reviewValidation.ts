import type { CourseReview, CourseReviewDraft } from '../types.ts'

export const MIN_COMMENT_LENGTH = 3
export const MAX_COMMENT_LENGTH = 2000

export const EMPTY_REVIEW_DRAFT: CourseReviewDraft = {
  overallRating: 0,
  examRating: 0,
  contentRating: 0,
  tutorialRating: 0,
  comment: '',
  takenPeriodLabel: '',
  lecturerName: '',
}

export type ReviewDraftError =
  | 'missingOverallRating'
  | 'commentTooShort'
  | 'commentTooLong'

export function toReviewDraft(review: CourseReview | null, knownLecturers: string[]): CourseReviewDraft {
  if (!review) {
    return { ...EMPTY_REVIEW_DRAFT }
  }
  const lecturerName = review.lecturerName ?? ''
  const isKnownLecturer = knownLecturers.some((candidate) => candidate === lecturerName)
  return {
    overallRating: review.overallRating,
    examRating: review.examRating ?? 0,
    contentRating: review.contentRating ?? 0,
    tutorialRating: review.tutorialRating ?? 0,
    comment: review.comment ?? '',
    takenPeriodLabel: review.takenPeriodLabel ?? '',
    // Legacy custom names remain visible on the published review, but cannot
    // silently flow into a new submission when the author edits it.
    lecturerName: isKnownLecturer ? lecturerName : '',
  }
}

export function validateReviewDraft(draft: CourseReviewDraft): ReviewDraftError | null {
  if (draft.overallRating < 1 || draft.overallRating > 5) {
    return 'missingOverallRating'
  }

  const comment = draft.comment.trim()
  if (comment.length > 0 && comment.length < MIN_COMMENT_LENGTH) {
    return 'commentTooShort'
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return 'commentTooLong'
  }

  return null
}

export interface CourseReviewPayload {
  overallRating: number
  examRating: number | null
  contentRating: number | null
  tutorialRating: number | null
  comment: string | null
  takenPeriodLabel: string | null
  lecturerName: string | null
}

function toOptionalRating(rating: number): number | null {
  return rating >= 1 && rating <= 5 ? rating : null
}

/**
 * Lecturer names must come from the catalogue-provided options.
 */
export function buildReviewPayload(draft: CourseReviewDraft): CourseReviewPayload {
  const comment = draft.comment.trim()

  return {
    overallRating: draft.overallRating,
    examRating: toOptionalRating(draft.examRating),
    contentRating: toOptionalRating(draft.contentRating),
    tutorialRating: toOptionalRating(draft.tutorialRating),
    comment: comment || null,
    takenPeriodLabel: draft.takenPeriodLabel.trim() || null,
    lecturerName: draft.lecturerName.trim() || null,
  }
}

import type { CourseReview, CourseReviewDraft } from '../types.ts'

export const MIN_COMMENT_LENGTH = 3
export const MAX_COMMENT_LENGTH = 2000
export const MAX_LECTURER_NAME_LENGTH = 80
/** Sentinel for "my lecturer is not in the list"; never sent to the server. */
export const OTHER_LECTURER_VALUE = '__other__'

export const EMPTY_REVIEW_DRAFT: CourseReviewDraft = {
  overallRating: 0,
  examRating: 0,
  contentRating: 0,
  tutorialRating: 0,
  comment: '',
  takenPeriodLabel: '',
  lecturerName: '',
  lecturerCustomName: '',
}

export type ReviewDraftError =
  | 'missingOverallRating'
  | 'commentTooShort'
  | 'commentTooLong'
  | 'lecturerNameTooLong'

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
    lecturerName: isKnownLecturer ? lecturerName : lecturerName ? OTHER_LECTURER_VALUE : '',
    lecturerCustomName: isKnownLecturer || !lecturerName ? '' : lecturerName,
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

  if (
    draft.lecturerName === OTHER_LECTURER_VALUE
    && draft.lecturerCustomName.trim().length > MAX_LECTURER_NAME_LENGTH
  ) {
    return 'lecturerNameTooLong'
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
  lecturerCustomName: string | null
}

function toOptionalRating(rating: number): number | null {
  return rating >= 1 && rating <= 5 ? rating : null
}

/**
 * The server rejects a payload carrying both a picked and a typed lecturer, so
 * the "Other" sentinel is resolved to exactly one of the two here.
 */
export function buildReviewPayload(draft: CourseReviewDraft): CourseReviewPayload {
  const isCustomLecturer = draft.lecturerName === OTHER_LECTURER_VALUE
  const customName = draft.lecturerCustomName.trim()
  const comment = draft.comment.trim()

  return {
    overallRating: draft.overallRating,
    examRating: toOptionalRating(draft.examRating),
    contentRating: toOptionalRating(draft.contentRating),
    tutorialRating: toOptionalRating(draft.tutorialRating),
    comment: comment || null,
    takenPeriodLabel: draft.takenPeriodLabel.trim() || null,
    lecturerName: isCustomLecturer ? null : draft.lecturerName.trim() || null,
    lecturerCustomName: isCustomLecturer ? customName || null : null,
  }
}

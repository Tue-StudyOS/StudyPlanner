import type { ReviewNoticeCategory, ReviewNoticePayload } from '../types.ts'

export const MAX_NOTICE_ALLEGATION_LENGTH = 200
export const MAX_NOTICE_EXPLANATION_LENGTH = 2000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ReviewNoticeDraft {
  category: ReviewNoticeCategory | ''
  allegation: string
  explanation: string
  contactEmail: string
  goodFaith: boolean
}

export type ReviewNoticeDraftError =
  | 'missingCategory'
  | 'invalidAllegation'
  | 'invalidExplanation'
  | 'invalidEmail'
  | 'goodFaithRequired'

export function validateReviewNoticeDraft(
  draft: ReviewNoticeDraft,
): ReviewNoticeDraftError | null {
  if (!draft.category) {
    return 'missingCategory'
  }
  const allegationLength = draft.allegation.trim().length
  if (allegationLength < 3 || allegationLength > MAX_NOTICE_ALLEGATION_LENGTH) {
    return 'invalidAllegation'
  }
  const explanationLength = draft.explanation.trim().length
  if (explanationLength < 10 || explanationLength > MAX_NOTICE_EXPLANATION_LENGTH) {
    return 'invalidExplanation'
  }
  const email = draft.contactEmail.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'invalidEmail'
  }
  if (!draft.goodFaith) {
    return 'goodFaithRequired'
  }
  return null
}

export function buildReviewNoticePayload(
  reviewId: number,
  draft: ReviewNoticeDraft,
): ReviewNoticePayload {
  if (!draft.category) {
    throw new Error('A validated review notice must have a category.')
  }
  return {
    reviewId,
    category: draft.category,
    allegation: draft.allegation.trim(),
    explanation: draft.explanation.trim(),
    contactEmail: draft.contactEmail.trim().toLowerCase(),
    goodFaith: true,
  }
}

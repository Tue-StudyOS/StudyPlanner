// The catalog list already carries this shape on every course, so it stays
// defined with the course payload rather than duplicated here.
export type { CourseRatingSummary } from '../courses/types.ts'

export interface CourseReviewBreakdown {
  '1': number
  '2': number
  '3': number
  '4': number
  '5': number
}

export interface CourseReviewSummary {
  average: number | null
  count: number
  breakdown: CourseReviewBreakdown
  examAverage: number | null
  contentAverage: number | null
  tutorialAverage: number | null
}

export interface CourseReview {
  id: number
  overallRating: number
  examRating: number | null
  contentRating: number | null
  tutorialRating: number | null
  comment: string | null
  takenPeriodLabel: string | null
  /** Already resolved server-side from the public catalogue choice. */
  lecturerName: string | null
  createdAtUnix: number | null
  updatedAtUnix: number | null
  isMine: boolean
  moderationDecision: {
    status: string
    action: string | null
    category: string | null
    reason: string | null
    decidedAtUnix: number | null
    redressPath: string
  } | null
}

export interface CourseReviewOptions {
  periodLabels: string[]
  lecturers: string[]
}

export interface CourseReviewsResponse {
  summary: CourseReviewSummary
  reviews: CourseReview[]
  options: CourseReviewOptions
  viewerReview: CourseReview | null
}

export interface CourseReviewDraft {
  overallRating: number
  examRating: number
  contentRating: number
  tutorialRating: number
  comment: string
  takenPeriodLabel: string
  lecturerName: string
}

export type ReviewNoticeCategory =
  | 'illegal_content'
  | 'privacy'
  | 'harassment'
  | 'defamation'
  | 'off_topic'
  | 'moderation_redress'
  | 'other'

export interface ReviewNoticePayload {
  reviewId: number
  category: ReviewNoticeCategory
  allegation: string
  explanation: string
  contactEmail: string
  goodFaith: true
}

export interface ReviewNoticeReceipt {
  notice: {
    reference: string
    status: 'received'
    receivedAtUnix: number | null
  }
}

import type { CourseRatingSummary } from '../../courses/types.ts'
import type { CourseReview, CourseReviewSummary } from '../types.ts'

/** Star averages are shown to one decimal, the way map and store ratings read. */
export function formatAverageRating(average: number | null): string | null {
  if (average === null || !Number.isFinite(average)) {
    return null
  }
  return average.toFixed(1)
}

/**
 * The catalog ships ~1000 courses and most will have no reviews for a long
 * time, so an empty placeholder on every tile would be pure noise.
 */
export function shouldShowRatingChip(rating: CourseRatingSummary | undefined | null): boolean {
  if (!rating) {
    return false
  }
  return rating.count > 0 && Number.isFinite(rating.average)
}

/** Share of reviews that gave a given star, for the breakdown bars. */
export function getBreakdownPercentage(count: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return Math.round((count / total) * 100)
}

export interface SubRatingRow {
  key: 'exam' | 'content' | 'tutorial'
  average: number
}

/**
 * Sub-ratings are optional per review, so a course can have an overall average
 * with no exam average at all. Only rows that were actually rated are listed.
 */
export function getSubRatingRows(summary: CourseReviewSummary): SubRatingRow[] {
  const candidates: { key: SubRatingRow['key']; average: number | null }[] = [
    { key: 'exam', average: summary.examAverage },
    { key: 'content', average: summary.contentAverage },
    { key: 'tutorial', average: summary.tutorialAverage },
  ]
  return candidates.filter(
    (candidate): candidate is SubRatingRow =>
      candidate.average !== null && Number.isFinite(candidate.average),
  )
}

/** The viewer's own review sorts first so editing it is always one click away. */
export function sortReviewsForDisplay(reviews: CourseReview[]): CourseReview[] {
  return [...reviews].sort((left, right) => {
    if (left.isMine !== right.isMine) {
      return left.isMine ? -1 : 1
    }
    return (right.updatedAtUnix ?? 0) - (left.updatedAtUnix ?? 0)
  })
}

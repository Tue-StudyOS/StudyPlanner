import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseReview, CourseReviewSummary } from '../../src/features/reviews/types.ts'
import {
  formatAverageRating,
  getBreakdownPercentage,
  getSubRatingRows,
  shouldShowRatingChip,
  sortReviewsForDisplay,
} from '../../src/features/reviews/utils/reviewSummary.ts'

function buildSummary(overrides: Partial<CourseReviewSummary> = {}): CourseReviewSummary {
  return {
    average: 4.25,
    count: 4,
    breakdown: { '1': 0, '2': 0, '3': 1, '4': 1, '5': 2 },
    examAverage: null,
    contentAverage: null,
    tutorialAverage: null,
    ...overrides,
  }
}

function buildReview(overrides: Partial<CourseReview> = {}): CourseReview {
  return {
    id: 1,
    overallRating: 4,
    examRating: null,
    contentRating: null,
    tutorialRating: null,
    comment: null,
    takenPeriodLabel: null,
    lecturerName: null,
    createdAtUnix: 100,
    updatedAtUnix: 100,
    isMine: false,
    ...overrides,
  }
}

test('formatAverageRating renders one decimal and passes through missing averages', () => {
  assert.equal(formatAverageRating(4.25), '4.3')
  assert.equal(formatAverageRating(5), '5.0')
  assert.equal(formatAverageRating(null), null)
})

test('rating chip stays hidden until a course actually has reviews', () => {
  assert.equal(shouldShowRatingChip(undefined), false)
  assert.equal(shouldShowRatingChip(null), false)
  assert.equal(shouldShowRatingChip({ average: 0, count: 0 }), false)
  assert.equal(shouldShowRatingChip({ average: 4.5, count: 2 }), true)
})

test('breakdown percentages are safe when a course has no reviews', () => {
  assert.equal(getBreakdownPercentage(0, 0), 0)
  assert.equal(getBreakdownPercentage(1, 4), 25)
  assert.equal(getBreakdownPercentage(3, 3), 100)
})

test('only sub-ratings that were actually given are listed', () => {
  assert.deepEqual(getSubRatingRows(buildSummary()), [])

  const rows = getSubRatingRows(buildSummary({ examAverage: 3.5, tutorialAverage: 5 }))
  assert.deepEqual(rows, [
    { key: 'exam', average: 3.5 },
    { key: 'tutorial', average: 5 },
  ])
})

test('the viewer own review sorts first, then newest first', () => {
  const sorted = sortReviewsForDisplay([
    buildReview({ id: 1, updatedAtUnix: 100 }),
    buildReview({ id: 2, updatedAtUnix: 50, isMine: true }),
    buildReview({ id: 3, updatedAtUnix: 300 }),
  ])

  assert.deepEqual(
    sorted.map((review) => review.id),
    [2, 3, 1],
  )
})

test('sorting does not mutate the input list', () => {
  const reviews = [buildReview({ id: 1, updatedAtUnix: 1 }), buildReview({ id: 2, updatedAtUnix: 9 })]
  sortReviewsForDisplay(reviews)

  assert.deepEqual(
    reviews.map((review) => review.id),
    [1, 2],
  )
})

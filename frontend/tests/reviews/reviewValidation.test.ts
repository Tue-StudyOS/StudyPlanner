import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseReview, CourseReviewDraft } from '../../src/features/reviews/types.ts'
import {
  EMPTY_REVIEW_DRAFT,
  MAX_COMMENT_LENGTH,
  buildReviewPayload,
  toReviewDraft,
  validateReviewDraft,
} from '../../src/features/reviews/utils/reviewValidation.ts'

const KNOWN_LECTURERS = ['Prof. Dr. Anna Beispiel', 'Dr. Bernd Muster']

function buildDraft(overrides: Partial<CourseReviewDraft> = {}): CourseReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, overallRating: 4, ...overrides }
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
    isMine: true,
    moderationDecision: null,
    ...overrides,
  }
}

test('an overall rating is required', () => {
  assert.equal(validateReviewDraft(buildDraft({ overallRating: 0 })), 'missingOverallRating')
  assert.equal(validateReviewDraft(buildDraft({ overallRating: 6 })), 'missingOverallRating')
  assert.equal(validateReviewDraft(buildDraft()), null)
})

test('an empty comment is allowed but a one-word stub is not', () => {
  assert.equal(validateReviewDraft(buildDraft({ comment: '   ' })), null)
  assert.equal(validateReviewDraft(buildDraft({ comment: 'ok' })), 'commentTooShort')
  assert.equal(validateReviewDraft(buildDraft({ comment: 'Good course.' })), null)
  assert.equal(
    validateReviewDraft(buildDraft({ comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1) })),
    'commentTooLong',
  )
})

test('a minimal draft becomes a payload with every optional field cleared', () => {
  assert.deepEqual(buildReviewPayload(buildDraft({ overallRating: 5 })), {
    overallRating: 5,
    examRating: null,
    contentRating: null,
    tutorialRating: null,
    comment: null,
    takenPeriodLabel: null,
    lecturerName: null,
  })
})

test('the payload carries only a catalogue-picked lecturer', () => {
  const picked = buildReviewPayload(buildDraft({ lecturerName: 'Dr. Bernd Muster' }))
  assert.equal(picked.lecturerName, 'Dr. Bernd Muster')
})

test('cleared sub-ratings and whitespace-only text are sent as null', () => {
  const payload = buildReviewPayload(
    buildDraft({ examRating: 0, contentRating: 3, comment: '   ', takenPeriodLabel: '  ' }),
  )

  assert.equal(payload.examRating, null)
  assert.equal(payload.contentRating, 3)
  assert.equal(payload.comment, null)
  assert.equal(payload.takenPeriodLabel, null)
})

test('an existing review pre-fills the draft', () => {
  const draft = toReviewDraft(
    buildReview({
      overallRating: 5,
      examRating: 2,
      comment: 'Solid lecture.',
      takenPeriodLabel: 'Sommer 2025',
      lecturerName: 'Dr. Bernd Muster',
    }),
    KNOWN_LECTURERS,
  )

  assert.equal(draft.overallRating, 5)
  assert.equal(draft.examRating, 2)
  assert.equal(draft.tutorialRating, 0)
  assert.equal(draft.comment, 'Solid lecture.')
  assert.equal(draft.takenPeriodLabel, 'Sommer 2025')
  assert.equal(draft.lecturerName, 'Dr. Bernd Muster')
})

test('a legacy lecturer no longer in the catalog is not resubmitted', () => {
  const draft = toReviewDraft(buildReview({ lecturerName: 'Dr. Retired Person' }), KNOWN_LECTURERS)

  assert.equal(draft.lecturerName, '')
})

test('no existing review yields an empty draft', () => {
  assert.deepEqual(toReviewDraft(null, KNOWN_LECTURERS), EMPTY_REVIEW_DRAFT)
})

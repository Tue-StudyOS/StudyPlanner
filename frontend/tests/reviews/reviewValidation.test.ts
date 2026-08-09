import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseReview, CourseReviewDraft } from '../../src/features/reviews/types.ts'
import {
  EMPTY_REVIEW_DRAFT,
  MAX_COMMENT_LENGTH,
  MAX_LECTURER_NAME_LENGTH,
  OTHER_LECTURER_VALUE,
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
    ...overrides,
  }
}

test('an overall rating is required', () => {
  assert.equal(validateReviewDraft(buildDraft({ overallRating: 0 })), 'missingOverallRating')
  assert.equal(validateReviewDraft(buildDraft({ overallRating: 6 })), 'missingOverallRating')
  assert.equal(validateReviewDraft(buildDraft()), null)
})

test('comments are optional and length-limited', () => {
  assert.equal(validateReviewDraft(buildDraft({ comment: '   ' })), null)
  assert.equal(validateReviewDraft(buildDraft({ comment: 'ok' })), 'commentTooShort')
  assert.equal(validateReviewDraft(buildDraft({ comment: 'Good course.' })), null)
  assert.equal(
    validateReviewDraft(buildDraft({ comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1) })),
    'commentTooLong',
  )
})

test('a manually typed lecturer name is length capped', () => {
  assert.equal(
    validateReviewDraft(
      buildDraft({
        lecturerName: OTHER_LECTURER_VALUE,
        lecturerCustomName: 'x'.repeat(MAX_LECTURER_NAME_LENGTH + 1),
      }),
    ),
    'lecturerNameTooLong',
  )
})

test('the payload never carries both a picked and typed lecturer', () => {
  const picked = buildReviewPayload(buildDraft({ lecturerName: 'Dr. Bernd Muster' }))
  assert.equal(picked.lecturerName, 'Dr. Bernd Muster')
  assert.equal(picked.lecturerCustomName, null)

  const typed = buildReviewPayload(
    buildDraft({ lecturerName: OTHER_LECTURER_VALUE, lecturerCustomName: '  Dr. Neu Hinzu  ' }),
  )
  assert.equal(typed.lecturerName, null)
  assert.equal(typed.lecturerCustomName, 'Dr. Neu Hinzu')
})

test('an existing review pre-fills known and custom lecturer choices', () => {
  const known = toReviewDraft(
    buildReview({ lecturerName: 'Dr. Bernd Muster', comment: 'Solid lecture.' }),
    KNOWN_LECTURERS,
  )
  assert.equal(known.lecturerName, 'Dr. Bernd Muster')
  assert.equal(known.lecturerCustomName, '')

  const custom = toReviewDraft(
    buildReview({ lecturerName: 'Dr. Retired Person' }),
    KNOWN_LECTURERS,
  )
  assert.equal(custom.lecturerName, OTHER_LECTURER_VALUE)
  assert.equal(custom.lecturerCustomName, 'Dr. Retired Person')
})

test('no existing review yields an empty draft', () => {
  assert.deepEqual(toReviewDraft(null, KNOWN_LECTURERS), EMPTY_REVIEW_DRAFT)
})

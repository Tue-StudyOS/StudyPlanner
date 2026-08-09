import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildReviewNoticePayload,
  validateReviewNoticeDraft,
  type ReviewNoticeDraft,
} from '../../src/features/reviews/utils/reviewNoticeValidation.ts'

function draft(overrides: Partial<ReviewNoticeDraft> = {}): ReviewNoticeDraft {
  return {
    category: 'privacy',
    allegation: 'Personal data disclosed',
    explanation: 'The final sentence contains a private email address.',
    contactEmail: ' Reporter@Example.test ',
    goodFaith: true,
    ...overrides,
  }
}

test('requires category, allegation, explanation, email, and good-faith confirmation', () => {
  assert.equal(validateReviewNoticeDraft(draft({ category: '' })), 'missingCategory')
  assert.equal(validateReviewNoticeDraft(draft({ allegation: 'x' })), 'invalidAllegation')
  assert.equal(validateReviewNoticeDraft(draft({ explanation: 'short' })), 'invalidExplanation')
  assert.equal(validateReviewNoticeDraft(draft({ contactEmail: 'invalid' })), 'invalidEmail')
  assert.equal(validateReviewNoticeDraft(draft({ goodFaith: false })), 'goodFaithRequired')
  assert.equal(validateReviewNoticeDraft(draft()), null)
})

test('builds a minimized normalized public notice payload', () => {
  assert.deepEqual(buildReviewNoticePayload(17, draft()), {
    reviewId: 17,
    category: 'privacy',
    allegation: 'Personal data disclosed',
    explanation: 'The final sentence contains a private email address.',
    contactEmail: 'reporter@example.test',
    goodFaith: true,
  })
})

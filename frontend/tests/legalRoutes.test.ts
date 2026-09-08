import assert from 'node:assert/strict'
import test from 'node:test'
import { ROUTES } from '../src/features/routes.ts'

test('public legal and review-information routes stay stable', () => {
  assert.equal(ROUTES.privacy, '/privacy')
  assert.equal(ROUTES.imprint, '/impressum')
  assert.equal(ROUTES.reviewRules, '/review-rules')
})

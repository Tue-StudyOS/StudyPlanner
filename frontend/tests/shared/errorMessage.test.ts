import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../src/shared/utils/api.ts'
import { getErrorMessage } from '../../src/shared/utils/errorMessage.ts'

test('getErrorMessage keeps known error messages', () => {
  assert.equal(getErrorMessage(new Error('plain failure'), 'fallback'), 'plain failure')
  assert.equal(getErrorMessage(new ApiError('API failure', 503), 'fallback'), 'API failure')
})

test('getErrorMessage falls back for non-error values', () => {
  assert.equal(getErrorMessage(null, 'fallback'), 'fallback')
})

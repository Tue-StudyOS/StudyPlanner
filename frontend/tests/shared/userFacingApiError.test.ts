import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../src/shared/utils/api.ts'
import { toUserFacingApiMessage } from '../../src/shared/utils/userFacingApiError.ts'

test('toUserFacingApiMessage softens network failures', () => {
  const message = toUserFacingApiMessage(new ApiError('raw', 0, 'network_error'))
  assert.match(message, /temporarily unavailable/i)
  assert.doesNotMatch(message, /connection/i)
})

test('toUserFacingApiMessage softens server errors', () => {
  const message = toUserFacingApiMessage(new ApiError('db down', 503, 'server_error'))
  assert.match(message, /went wrong on our side/i)
})

test('toUserFacingApiMessage keeps explicit client errors', () => {
  const message = toUserFacingApiMessage(new ApiError('Invalid semester label', 400, 'bad_request'))
  assert.equal(message, 'Invalid semester label')
})

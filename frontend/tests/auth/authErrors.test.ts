import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../src/shared/utils/api.ts'
import { normalizeAuthErrorMessage } from '../../src/features/auth/utils/authErrors.ts'

test('normalizeAuthErrorMessage keeps API error messages', () => {
  const message = normalizeAuthErrorMessage(new ApiError('Invalid credentials.', 401))

  assert.equal(message, 'Invalid credentials.')
})

test('normalizeAuthErrorMessage adds a local setup hint for missing auth secrets', () => {
  const message = normalizeAuthErrorMessage(
    new ApiError('AUTH_TOKEN_SECRET must be configured as a Worker secret.', 500),
    { isLocalDevelopment: true },
  )

  assert.equal(
    message,
    'AUTH_TOKEN_SECRET must be configured as a Worker secret. Add AUTH_TOKEN_SECRET to backend/.dev.vars, restart `npx wrangler dev`, and try again.',
  )
})

test('normalizeAuthErrorMessage falls back for unknown errors', () => {
  assert.equal(normalizeAuthErrorMessage(null), 'Something went wrong.')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createCsrfHeaders, createLegacyBearerHeaders } from '../../src/shared/utils/api.ts'

test('creates a CSRF header without exposing an authorization bearer', () => {
  assert.deepEqual(createCsrfHeaders('csrf-proof'), { 'X-CSRF-Token': 'csrf-proof' })
  assert.deepEqual(createCsrfHeaders(null), {})
})

test('keeps bearer headers only for one-time legacy session migration', () => {
  assert.deepEqual(createLegacyBearerHeaders('legacy-token'), { Authorization: 'Bearer legacy-token' })
  assert.deepEqual(createLegacyBearerHeaders(undefined), {})
})

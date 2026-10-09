import assert from 'node:assert/strict'
import test from 'node:test'
import { parseApiErrorBody } from '../../src/shared/utils/api.ts'

test('parseApiErrorBody reads structured JSON error payloads', () => {
  assert.deepEqual(
    parseApiErrorBody('{"error":"authentication_failed","message":"Invalid credentials."}', 401),
    { message: 'Invalid credentials.', code: 'authentication_failed' },
  )
})

test('parseApiErrorBody replaces HTML error pages with a generic status message', () => {
  assert.deepEqual(parseApiErrorBody('<!DOCTYPE html><html><body>Worker threw exception</body></html>', 500), {
    message: 'Request failed with status 500',
  })
})

test('parseApiErrorBody identifies Cloudflare runtime errors in text and HTML', () => {
  for (const body of ['error code: 1101', '<html><title>Error 1101</title>private page</html>']) {
    assert.deepEqual(parseApiErrorBody(body, 500), {
      message: 'Request failed with status 500', code: 'cloudflare_1101',
    })
  }
})

test('parseApiErrorBody falls back to the status message for empty bodies', () => {
  assert.deepEqual(parseApiErrorBody('', 502), { message: 'Request failed with status 502' })
})

test('parseApiErrorBody falls back to the status message for JSON payloads without a message', () => {
  assert.deepEqual(parseApiErrorBody('{"error":"database_error"}', 500), {
    message: 'Request failed with status 500',
    code: 'database_error',
  })
})

test('parseApiErrorBody does not trust non-string fields in external JSON', () => {
  assert.deepEqual(parseApiErrorBody('{"message":{"password":"private"},"error":123}', 500), {
    message: 'Request failed with status 500', code: undefined,
  })
})

test('parseApiErrorBody treats non-object JSON bodies as plain text', () => {
  assert.deepEqual(parseApiErrorBody('123', 500), { message: '123' })
})

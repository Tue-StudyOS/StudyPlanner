import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const headersFile = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')

test('Pages applies a CSP compatible with the deployed app topology', () => {
  assert.match(headersFile, /Content-Security-Policy:/)
  assert.match(headersFile, /connect-src 'self' https:\/\/studyplanner-api\.ben-tischberger\.workers\.dev/)
  assert.match(headersFile, /font-src 'self'/)
  assert.match(headersFile, /script-src 'self'/)
  assert.match(headersFile, /style-src 'self' 'unsafe-inline'/)
  assert.match(headersFile, /worker-src 'self' blob:/)
  assert.match(headersFile, /frame-ancestors 'none'/)
})

test('Pages sends the remaining baseline browser security headers', () => {
  assert.match(headersFile, /Strict-Transport-Security: max-age=31536000; includeSubDomains/)
  assert.match(headersFile, /X-Content-Type-Options: nosniff/)
  assert.match(headersFile, /X-Frame-Options: DENY/)
  assert.match(headersFile, /Referrer-Policy: strict-origin-when-cross-origin/)
  assert.match(headersFile, /Permissions-Policy: camera=\(\), geolocation=\(\), microphone=\(\)/)
})

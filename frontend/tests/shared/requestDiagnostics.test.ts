import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRequestId,
  describeRequestDiagnostics,
  extractCloudflareErrorCode,
} from '../../src/shared/utils/requestDiagnostics.ts'
import { appendApiRequestLog, clearApiRequestLog, readApiRequestLog } from '../../src/shared/utils/apiRequestLog.ts'

test('request IDs are bounded, safe, and unique for each attempt', () => {
  assert.equal(createRequestId('request-1'), 'request-1')
  assert.notEqual(createRequestId('Cookie: private'), 'Cookie: private')
  assert.notEqual(createRequestId(), createRequestId())
  assert.match(createRequestId(), /^[A-Za-z0-9_-]{1,80}$/)
})

test('extracts a Cloudflare runtime number without retaining an HTML page', () => {
  assert.equal(extractCloudflareErrorCode('<html><title>Error 1101</title>private</html>'), '1101')
  assert.equal(extractCloudflareErrorCode('error code: 1102'), '1102')
  assert.equal(extractCloudflareErrorCode('<html>Something else</html>'), undefined)
})

test('captures both routing layers, deployment and isolate evidence without response content', () => {
  const response = new Response('<html>token=private</html>', { status: 500, headers: {
    'x-request-id': 'request-1', 'cf-ray': 'outer-FRA', 'x-upstream-cf-ray': 'inner-FRA',
    'x-worker-version': 'version-1', 'x-error-source': 'upstream',
    'x-isolate-id': 'isolate-1', 'x-isolate-seq': '31', 'x-isolate-age-ms': '5000',
    'content-type': 'text/html',
  } })
  const detail = describeRequestDiagnostics(response, 'fallback', 2, 0, '<title>Error 1101</title>token=private')
  for (const value of ['request-1', 'outer-FRA', 'inner-FRA', 'version-1', 'isolate-1', '1970-01-01', '1101']) {
    assert.ok(detail.includes(value))
  }
  assert.match(detail, /Attempt: 2/)
  assert.doesNotMatch(detail, /token=private|<title>/)
  assert.match(describeRequestDiagnostics(null, 'offline-1', 1, 0), /Request ID: offline-1/)
})

test('session logs retain bounded redacted diagnostics and return independent snapshots', () => {
  clearApiRequestLog()
  for (let i = 0; i < 90; i++) {
    appendApiRequestLog({ timestamp: i, method: 'GET', url: '/api/config?token=private', status: 500,
      message: 'ada@example.test', detail: 'Request ID: request-1\npassword="private value"' })
  }
  const entries = readApiRequestLog()
  assert.equal(entries.length, 80)
  assert.equal(entries[0].url, '/api/config')
  assert.doesNotMatch(JSON.stringify(entries), /ada@example.test|private/)
  assert.match(entries[0].detail ?? '', /Request ID: request-1/)
  entries[0].message = 'changed'
  assert.notEqual(readApiRequestLog()[0].message, 'changed')
  clearApiRequestLog()
})

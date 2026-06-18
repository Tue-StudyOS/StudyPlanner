import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUpstreamUrl, resolveFallbackOrigin } from '../../functions/_shared/proxy.ts'

test('Pages gateway keeps the public path and query while switching only the upstream origin', () => {
  assert.equal(
    buildUpstreamUrl('https://studyplaner.pages.dev/api/ai/openapi.json?x=1', 'http://localhost:8787'),
    'http://localhost:8787/api/ai/openapi.json?x=1',
  )
})

test('Pages gateway only falls back to local origins during local development', () => {
  assert.equal(resolveFallbackOrigin('http://localhost:5173/api/ai/meta', 'api'), 'http://localhost:8787')
  assert.equal(resolveFallbackOrigin('http://127.0.0.1:5173/mcp', 'mcp'), 'http://localhost:8788')
  assert.equal(resolveFallbackOrigin('https://studyplaner.pages.dev/mcp', 'mcp'), undefined)
})

test('Pages gateway accepts explicit local fallback origins for manual testing', () => {
  assert.equal(
    resolveFallbackOrigin('https://studyplaner.pages.dev/api/ai/meta', 'api', 'http://localhost:9000/'),
    'http://localhost:9000',
  )
})

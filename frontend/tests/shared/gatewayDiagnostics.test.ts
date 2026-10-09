import assert from 'node:assert/strict'
import test from 'node:test'
import { proxyToGatewayTarget } from '../../functions/_shared/proxy.ts'

test('gateway forwards correlation IDs and preserves upstream status, cookies and diagnostic headers', async (context) => {
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const request = input as Request
    assert.equal(request.headers.get('x-request-id'), 'request-1')
    assert.equal(request.url, 'https://upstream.test/api/auth/session?public=1')
    return new Response('{"authenticated":true}', { status: 200, headers: {
      'set-cookie': 'session=private; HttpOnly', 'cf-ray': 'inner-FRA',
      'x-worker-version': 'version-1', 'x-isolate-id': 'isolate-1',
    } })
  })
  const response = await proxyToGatewayTarget({
    request: new Request('https://pages.test/api/auth/session?public=1', { headers: { 'x-request-id': 'request-1' } }),
    env: { STUDYPLANNER_API_ORIGIN: 'https://upstream.test' },
  }, 'api')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-request-id'), 'request-1')
  assert.equal(response.headers.get('x-upstream-cf-ray'), 'inner-FRA')
  assert.equal(response.headers.get('x-worker-version'), 'version-1')
  assert.equal(response.headers.get('set-cookie'), 'session=private; HttpOnly')
})

test('gateway catches a service-bound runtime exception and emits redacted correlated evidence', async (context) => {
  const logs: string[] = []
  context.mock.method(console, 'error', (message: string) => { logs.push(message) })
  const response = await proxyToGatewayTarget({
    request: new Request('https://pages.test/api/config?token=private', { headers: { 'x-request-id': 'request-2' } }),
    env: { STUDYPLANNER_API: { fetch: async () => { throw new Error('Worker had hung; password="private value"') } } },
  }, 'api')
  assert.equal(response.status, 502)
  assert.equal(response.headers.get('x-error-source'), 'gateway')
  assert.equal(response.headers.get('x-request-id'), 'request-2')
  assert.equal((await response.json()).requestId, 'request-2')
  assert.match(logs.join('\n'), /gateway_exception|request-2|worker_hung/)
  assert.doesNotMatch(logs.join('\n'), /private|token=/)
})

test('gateway distinguishes native upstream failures from application errors', async (context) => {
  context.mock.method(console, 'error', () => {})
  for (const source of [undefined, 'application']) {
    const response = await proxyToGatewayTarget({
      request: new Request('https://pages.test/api/config'),
      env: { STUDYPLANNER_API: { fetch: async () => new Response('error code: 1101', {
        status: 500, headers: source ? { 'x-error-source': source } : {},
      }) } },
    }, 'api')
    assert.equal(response.headers.get('x-error-source'), source ?? 'upstream')
    assert.match(response.headers.get('x-request-id') ?? '', /^[A-Za-z0-9_-]{1,80}$/)
    assert.equal(await response.text(), 'error code: 1101')
  }
})

test('cached catalog responses receive the current request ID, not the cached origin request ID', async (context) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    match: async () => new Response('{}', { headers: {
      'x-request-id': 'old-request', 'x-isolate-id': 'old-isolate', 'x-worker-version': 'old-version', 'cf-ray': 'old-FRA',
    } }),
  } } })
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'caches', original)
    else Reflect.deleteProperty(globalThis, 'caches')
  })
  const response = await proxyToGatewayTarget({
    request: new Request('https://pages.test/api/catalog/periods', { headers: { 'x-request-id': 'new-request' } }), env: {},
  }, 'api')
  assert.equal(response.headers.get('x-request-id'), 'new-request')
  assert.equal(response.headers.get('x-gateway-cache'), 'hit')
  for (const name of ['x-isolate-id', 'x-worker-version', 'x-upstream-cf-ray']) {
    assert.equal(response.headers.get(name), null)
  }
})

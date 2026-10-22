import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCatalogCourseDetail, fetchCatalogCourses } from '../../src/features/courses/api.ts'
import { SESSION_CACHE_SCHEMA_VERSION } from '../../src/shared/utils/browserStorageRegistry.ts'

test('catalog HTTP and session caches use the same metadata-contract version', async () => {
  const originalFetch = globalThis.fetch
  const requests: URL[] = []
  globalThis.fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost')
    requests.push(url)
    return new Response(JSON.stringify(url.pathname.endsWith('/42') ? { id: '42' } : { count: 0, courses: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await fetchCatalogCourses(' algebra ', 1000, 'all')
    await fetchCatalogCourseDetail('42')
    assert.equal(requests.length, 2)
    assert.equal(requests[0].searchParams.get('q'), 'algebra')
    assert.equal(requests[0].searchParams.get('period'), 'all')
    assert.equal(requests[0].searchParams.get('limit'), '1000')
    for (const request of requests) {
      assert.equal(request.searchParams.get('schema'), String(SESSION_CACHE_SCHEMA_VERSION))
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

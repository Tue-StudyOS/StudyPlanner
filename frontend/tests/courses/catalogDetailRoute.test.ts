import assert from 'node:assert/strict'
import test from 'node:test'
import {
  encodeCatalogDetailSegment,
  extractCatalogDetailCourseId,
} from '../../src/features/courses/utils/catalogDetailRoute.ts'

test('extractCatalogDetailCourseId reads the course id below the catalog base', () => {
  assert.equal(extractCatalogDetailCourseId('/catalog/12345', '/catalog'), '12345')
})

test('extractCatalogDetailCourseId returns null on the plain catalog page', () => {
  assert.equal(extractCatalogDetailCourseId('/catalog', '/catalog'), null)
  assert.equal(extractCatalogDetailCourseId('/catalog/', '/catalog'), null)
})

test('extractCatalogDetailCourseId ignores unrelated and deeper paths', () => {
  assert.equal(extractCatalogDetailCourseId('/transcript', '/catalog'), null)
  assert.equal(extractCatalogDetailCourseId('/catalog/12/extra', '/catalog'), null)
  assert.equal(extractCatalogDetailCourseId('/catalogue/12', '/catalog'), null)
})

test('extractCatalogDetailCourseId tolerates trailing slashes on both inputs', () => {
  assert.equal(extractCatalogDetailCourseId('/catalog/12345/', '/catalog/'), '12345')
})

test('round-trips ids that need URL encoding', () => {
  const courseId = 'ALMA 42/Ü'
  const segment = encodeCatalogDetailSegment(courseId)
  assert.equal(segment.includes('/'), false)
  assert.equal(extractCatalogDetailCourseId(`/catalog/${segment}`, '/catalog'), courseId)
})

test('extractCatalogDetailCourseId keeps malformed escapes as raw segment', () => {
  assert.equal(extractCatalogDetailCourseId('/catalog/%E0%A4%A', '/catalog'), '%E0%A4%A')
})

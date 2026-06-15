import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAlmaCourseUrl } from '../../src/features/courses/utils/almaUrl.ts'

test('prefixes a host-relative ALMA path with the ALMA host', () => {
  assert.equal(
    buildAlmaCourseUrl('/alma/pages/startFlow.xhtml?unitId=26660&periodId=229'),
    'https://alma.uni-tuebingen.de/alma/pages/startFlow.xhtml?unitId=26660&periodId=229',
  )
})

test('adds a missing leading slash before joining the host', () => {
  assert.equal(
    buildAlmaCourseUrl('alma/pages/startFlow.xhtml?unitId=1'),
    'https://alma.uni-tuebingen.de/alma/pages/startFlow.xhtml?unitId=1',
  )
})

test('passes an already absolute URL through unchanged', () => {
  assert.equal(
    buildAlmaCourseUrl('https://alma.uni-tuebingen.de/alma/pages/startFlow.xhtml?x=1'),
    'https://alma.uni-tuebingen.de/alma/pages/startFlow.xhtml?x=1',
  )
})

test('returns null for empty, whitespace, or missing input', () => {
  assert.equal(buildAlmaCourseUrl(''), null)
  assert.equal(buildAlmaCourseUrl('   '), null)
  assert.equal(buildAlmaCourseUrl(null), null)
  assert.equal(buildAlmaCourseUrl(undefined), null)
})

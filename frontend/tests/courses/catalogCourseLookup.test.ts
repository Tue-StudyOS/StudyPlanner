import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course } from '../../src/features/courses/types.ts'
import {
  buildCatalogCourseLookup,
  normalizeCatalogCourseIds,
} from '../../src/features/courses/utils/catalogCourseLookup.ts'

const course = {
  id: 'lecture',
  sourceCourseIds: ['lecture', 'exercise'],
  number: 'INFM1110',
  title: 'Practical Computer Science',
} as Course

test('buildCatalogCourseLookup resolves ALMA companion row ids to one logical course', () => {
  const lookup = buildCatalogCourseLookup([course])
  assert.equal(lookup.get('exercise'), course)
  assert.equal(lookup.get('lecture'), course)
})

test('normalizeCatalogCourseIds migrates aliases and removes duplicates', () => {
  const lookup = buildCatalogCourseLookup([course])
  assert.deepEqual(normalizeCatalogCourseIds(['exercise', 'lecture'], lookup), ['lecture'])
})

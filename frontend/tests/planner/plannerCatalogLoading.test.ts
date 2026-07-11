import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldLoadPlannerAllCatalogCourses } from '../../src/features/planner/utils/plannerCatalogLoading.ts'

test('planner skips the large all-period catalog when it is not needed', () => {
  assert.equal(shouldLoadPlannerAllCatalogCourses([], false), false)
  assert.equal(shouldLoadPlannerAllCatalogCourses(['favorite-1'], true), false)
  assert.equal(shouldLoadPlannerAllCatalogCourses(['favorite-1'], false), true)
})

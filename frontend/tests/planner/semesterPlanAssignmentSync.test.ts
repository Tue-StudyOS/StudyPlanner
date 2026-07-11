import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileSavedPlanAssignments } from '../../src/features/planner/utils/semesterPlanAssignments.ts'

test('reconcileSavedPlanAssignments adopts backend cleanup without overwriting newer edits', () => {
  assert.deepEqual(
    reconcileSavedPlanAssignments({ course: 'STALE' }, { course: 'STALE' }, {}),
    {},
  )
  assert.deepEqual(
    reconcileSavedPlanAssignments({ course: 'NEW' }, { course: 'STALE' }, {}),
    { course: 'NEW' },
  )
})

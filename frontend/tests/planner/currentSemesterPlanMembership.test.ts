import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dropCourseFromPlanFields,
  keepInterestedCoursesInPlanFields,
} from '../../src/features/planner/utils/currentSemesterPlanMembership.ts'
import type { SemesterPlan } from '../../src/features/planner/types.ts'

function createPlan(courseIds: string[]): Pick<
  SemesterPlan,
  'title' | 'notes' | 'courseIds' | 'hiddenSlotIds' | 'manualSlots' | 'courseAssignments'
> {
  return {
    title: null,
    notes: null,
    courseIds,
    hiddenSlotIds: courseIds.flatMap((courseId) => [`${courseId}:0`]),
    manualSlots: courseIds.map((courseId) => ({
      id: `${courseId}-slot`,
      courseId,
      day: 'Monday',
      time: '10:00',
    })),
    courseAssignments: Object.fromEntries(courseIds.map((courseId) => [courseId, 'INFO-INFO'])),
  }
}

test('dropCourseFromPlanFields removes one course and its slots from the plan', () => {
  const nextPlan = dropCourseFromPlanFields(createPlan(['keep', 'drop']), 'drop')

  assert.deepEqual(nextPlan.courseIds, ['keep'])
  assert.deepEqual(nextPlan.hiddenSlotIds, ['keep:0'])
  assert.deepEqual(nextPlan.manualSlots?.map((slot) => slot.courseId), ['keep'])
  assert.deepEqual(nextPlan.courseAssignments, { keep: 'INFO-INFO' })
})

test('keepInterestedCoursesInPlanFields drops planned courses that are no longer interested', () => {
  const nextPlan = keepInterestedCoursesInPlanFields(createPlan(['keep-a', 'drop', 'keep-b']), ['keep-b', 'keep-a'])

  assert.deepEqual(nextPlan.courseIds, ['keep-a', 'keep-b'])
  assert.deepEqual(nextPlan.hiddenSlotIds, ['keep-a:0', 'keep-b:0'])
  assert.deepEqual(nextPlan.courseAssignments, {
    'keep-a': 'INFO-INFO',
    'keep-b': 'INFO-INFO',
  })
})

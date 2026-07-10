import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getScheduleSlotId,
  isScheduleSlotHidden,
  isStoredSlotIdForCourse,
} from '../../src/features/planner/utils/scheduleSlotIds.ts'

const course = { id: 'lecture', sourceCourseIds: ['lecture', 'exercise'] }
const slot = {
  id: 'appointment-42',
  sourceCourseId: 'exercise',
  sourceIndex: 3,
  day: 'Tuesday',
  time: '10:00 - 12:00',
  room: 'C9',
  type: 'Übung',
}

test('getScheduleSlotId uses stable appointment ids', () => {
  assert.equal(getScheduleSlotId(course, slot, 8), 'lecture:appointment:appointment-42')
})

test('isScheduleSlotHidden accepts legacy source-row indexes', () => {
  assert.equal(isScheduleSlotHidden(['exercise:3'], course, slot, 8), true)
})

test('isStoredSlotIdForCourse recognizes every merged source course', () => {
  assert.equal(isStoredSlotIdForCourse('exercise:3', course), true)
  assert.equal(isStoredSlotIdForCourse('other:3', course), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { CourseParallelGroup } from '../../src/features/courses/index.ts'
import {
  summarizeGroupRoom,
  summarizeGroupSchedule,
  summarizeGroupSeats,
} from '../../src/features/planner/utils/parallelGroupSummary.ts'

function createGroup(overrides: Partial<CourseParallelGroup>): CourseParallelGroup {
  return {
    position: 1,
    title: null,
    role: null,
    maxParticipants: null,
    minParticipants: null,
    schedule: [],
    ...overrides,
  }
}

test('summarizeGroupSchedule joins unique weekday+time entries', () => {
  const group = createGroup({
    schedule: [
      { day: 'Mo', time: '14:00 - 16:00', room: 'N02', type: 'Vorlesung' },
      { day: 'Do', time: '14:00 - 16:00', room: 'N02', type: 'Vorlesung' },
      { day: 'Do', time: '14:00 - 16:00', room: 'N03', type: 'Vorlesung' },
    ],
  })

  assert.equal(
    summarizeGroupSchedule(group),
    'Mon 14:00 - 16:00 · Thu 14:00 - 16:00',
  )
})

test('summarizeGroupSchedule falls back when there is no weekly time', () => {
  assert.equal(summarizeGroupSchedule(createGroup({ schedule: [] })), 'No weekly time yet')
})

test('summarizeGroupRoom returns the first known room', () => {
  const group = createGroup({
    schedule: [
      { day: 'Mo', time: '14:00 - 16:00', room: 'TBA', type: 'Vorlesung' },
      { day: 'Mo', time: '14:00 - 16:00', room: 'C110', type: 'Vorlesung' },
    ],
  })
  assert.equal(summarizeGroupRoom(group), 'C110')
})

test('summarizeGroupSeats formats the known participant bounds', () => {
  assert.equal(summarizeGroupSeats(createGroup({ minParticipants: 5, maxParticipants: 30 })), '5–30 seats')
  assert.equal(summarizeGroupSeats(createGroup({ maxParticipants: 30 })), 'max 30 seats')
  assert.equal(summarizeGroupSeats(createGroup({})), '')
})

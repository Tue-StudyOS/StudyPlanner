import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course, ScheduleSlot } from '../../src/features/courses/index.ts'
import { buildPlannerBlocks } from '../../src/features/planner/utils/plannerFeedback.ts'

function createCourse(id: string, schedule: ScheduleSlot[]): Course {
  return {
    id,
    number: 'INF0000',
    title: id,
    lecturer: '',
    room: '',
    types: [],
    ects: 6,
    sws: null,
    masterCats: [],
    weekdays: [],
    schedule,
    frequency: '',
    language: 'German',
    prerequisites: [],
    description: '',
    exams: [],
  }
}

test('buildPlannerBlocks parses day aliases and time ranges', () => {
  const course = createCourse('lecture', [
    { day: 'Mo', time: '10:15 - 11:45', room: 'A104', type: 'lecture' },
    { day: 'do', time: '08:00-09:30', room: 'B210', type: 'exercise' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 2)
  assert.deepEqual(
    blocks.map((block) => [block.day, block.startMinutes, block.endMinutes, block.room]),
    [
      ['Monday', 615, 705, 'A104'],
      ['Thursday', 480, 570, 'B210'],
    ],
  )
  assert.ok(blocks.every((block) => !block.hasOverlap))
})

test('buildPlannerBlocks parses German ALMA weekday labels', () => {
  const course = createCourse('alma-weekdays', [
    { day: 'Montag', time: '10:15 - 11:45', room: 'A104', type: 'lecture' },
    { day: 'Di.', time: '12:15 - 13:45', room: 'B210', type: 'exercise' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 2)
  assert.deepEqual(
    blocks.map((block) => [block.day, block.startMinutes, block.endMinutes]),
    [
      ['Monday', 615, 705],
      ['Tuesday', 735, 825],
    ],
  )
})

test('buildPlannerBlocks skips slots with unknown days or unparsable times', () => {
  const course = createCourse('partial', [
    { day: 'Sa', time: '10:00 - 12:00', room: '', type: '' },
    { day: 'Mo', time: 'by appointment', room: '', type: '' },
    { day: 'Mo', time: '14:00 - 15:30', room: 'C1', type: '' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].day, 'Monday')
})

test('buildPlannerBlocks flags overlapping blocks on the same day only', () => {
  const courseA = createCourse('course-a', [
    { day: 'Mo', time: '10:00 - 12:00', room: '', type: '' },
  ])
  const courseB = createCourse('course-b', [
    { day: 'Mo', time: '11:00 - 13:00', room: '', type: '' },
    { day: 'Tue', time: '11:00 - 13:00', room: '', type: '' },
  ])

  const blocks = buildPlannerBlocks([courseA, courseB])

  const overlapByBlockId = new Map(blocks.map((block) => [block.blockId, block.hasOverlap]))
  assert.equal(overlapByBlockId.get('course-a-0'), true)
  assert.equal(overlapByBlockId.get('course-b-0'), true)
  assert.equal(overlapByBlockId.get('course-b-1'), false)
})

test('buildPlannerBlocks sorts by weekday then start time', () => {
  const course = createCourse('sorted', [
    { day: 'Fr', time: '08:00 - 09:00', room: '', type: '' },
    { day: 'Mo', time: '14:00 - 15:00', room: '', type: '' },
    { day: 'Mo', time: '08:00 - 09:00', room: '', type: '' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.deepEqual(
    blocks.map((block) => [block.day, block.startMinutes]),
    [
      ['Monday', 480],
      ['Monday', 840],
      ['Friday', 480],
    ],
  )
})

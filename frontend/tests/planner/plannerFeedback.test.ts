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

test('buildPlannerBlocks derives weekdays from ALMA date-range labels', () => {
  const course = createCourse('deployed-alma-dates', [
    { day: '24.04.2026 - 24.07.2026', time: '08:00 - 10:00', room: 'A2', type: 'lecture' },
    { day: '17.04.2026 - 24.07.2026', time: '10:00 - 12:00', room: 'A2', type: 'exercise' },
    { day: '21.04.2026 - 21.07.2026', time: '15:00 - 17:00', room: 'C215', type: 'lecture' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 3)
  assert.deepEqual(
    blocks.map((block) => [block.day, block.startMinutes, block.endMinutes]),
    [
      ['Tuesday', 900, 1020],
      ['Friday', 480, 600],
      ['Friday', 600, 720],
    ],
  )
})

test('buildPlannerBlocks skips one-off date slots such as exam dates', () => {
  const course = createCourse('with-exam-date', [
    { day: 'Mo', time: '10:00 - 12:00', room: 'A104', type: 'lecture' },
    { day: '28.07.2026', time: '10:00 - 12:00', room: 'Hörsaal 1', type: 'lecture' },
    { day: '28.07.2026 - 28.07.2026', time: '10:00 - 12:00', room: 'Hörsaal 1', type: 'lecture' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].day, 'Monday')
})

test('buildPlannerBlocks skips slots with unknown days or unparsable times', () => {
  const course = createCourse('partial', [
    { day: 'Sa', time: '10:00 - 12:00', room: '', type: '' },
    { day: '29.02.2026 - 01.03.2026', time: '10:00 - 12:00', room: '', type: '' },
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

test('buildPlannerBlocks does not flag the same course in parallel rooms as a conflict', () => {
  const course = createCourse('multi-room', [
    { day: 'Mo', time: '10:00 - 12:00', room: 'A104', type: 'lecture' },
    { day: 'Mo', time: '10:00 - 12:00', room: 'B210', type: 'lecture' },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.equal(blocks.length, 2)
  assert.ok(blocks.every((block) => !block.hasOverlap))
})

test('buildPlannerBlocks still flags two different courses sharing a room slot', () => {
  const courseA = createCourse('course-a', [
    { day: 'Mo', time: '10:00 - 12:00', room: 'A104', type: 'lecture' },
  ])
  const courseB = createCourse('course-b', [
    { day: 'Mo', time: '10:00 - 12:00', room: 'A104', type: 'lecture' },
  ])

  const blocks = buildPlannerBlocks([courseA, courseB])

  assert.ok(blocks.every((block) => block.hasOverlap))
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

test('buildPlannerBlocks shows only the selected parallel group', () => {
  const course = createCourse('stochastik', [
    { day: 'Mo', time: '14:00 - 16:00', room: 'N02', type: 'Vorlesung', groupPosition: 1 },
    { day: 'Mo', time: '16:00 - 18:00', room: 'C110', type: 'Übung', groupPosition: 2 },
  ])

  const lectureBlocks = buildPlannerBlocks([course], { stochastik: 1 })
  assert.deepEqual(
    lectureBlocks.map((block) => [block.startMinutes, block.room]),
    [[840, 'N02']],
  )

  const exerciseBlocks = buildPlannerBlocks([course], { stochastik: 2 })
  assert.deepEqual(
    exerciseBlocks.map((block) => [block.startMinutes, block.room]),
    [[960, 'C110']],
  )
})

test('buildPlannerBlocks defaults to the first group when no selection', () => {
  const course = createCourse('stochastik', [
    { day: 'Mo', time: '14:00 - 16:00', room: 'N02', type: 'Vorlesung', groupPosition: 1 },
    { day: 'Mo', time: '16:00 - 18:00', room: 'C110', type: 'Übung', groupPosition: 2 },
  ])

  const blocks = buildPlannerBlocks([course])

  assert.deepEqual(
    blocks.map((block) => block.room),
    ['N02'],
  )
})

test('buildPlannerBlocks falls back to first group for a stale selection', () => {
  const course = createCourse('stochastik', [
    { day: 'Mo', time: '14:00 - 16:00', room: 'N02', type: 'Vorlesung', groupPosition: 1 },
    { day: 'Mo', time: '16:00 - 18:00', room: 'C110', type: 'Übung', groupPosition: 2 },
  ])

  // Position 9 no longer exists (e.g. after a re-import); keep the course visible.
  const blocks = buildPlannerBlocks([course], { stochastik: 9 })

  assert.deepEqual(
    blocks.map((block) => block.room),
    ['N02'],
  )
})

test('buildPlannerBlocks keeps all slots when a course has no group positions', () => {
  const course = createCourse('legacy', [
    { day: 'Mo', time: '10:00 - 12:00', room: 'A', type: 'Vorlesung' },
    { day: 'Di', time: '10:00 - 12:00', room: 'B', type: 'Vorlesung' },
  ])

  const blocks = buildPlannerBlocks([course], { legacy: 1 })

  assert.equal(blocks.length, 2)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlannerBlock } from '../../src/features/planner/utils/plannerFeedback.ts'
import {
  END_HOUR,
  buildDayLayout,
  clampPlannerTimeRange,
} from '../../src/features/planner/utils/plannerDayLayout.ts'

function createBlock(id: string, startMinutes: number, endMinutes: number): PlannerBlock {
  return {
    blockId: id,
    slotId: id,
    legacySlotIds: [],
    courseId: id,
    courseTitle: id,
    day: 'Monday',
    startMinutes,
    endMinutes,
    label: '',
    room: '',
    slotType: '',
    slotKind: 'weekly',
    sessionRole: 'other',
    hasOverlap: false,
    isManual: false,
  }
}

test('buildDayLayout keeps sequential blocks in a single column', () => {
  const layout = buildDayLayout([
    createBlock('a', 8 * 60, 9 * 60),
    createBlock('b', 9 * 60, 10 * 60),
  ])

  assert.deepEqual(
    layout.visibleBlocks.map((block) => [block.blockId, block.columnIndex, block.visibleColumnCount]),
    [
      ['a', 0, 1],
      ['b', 0, 1],
    ],
  )
  assert.notEqual(layout.visibleBlocks[0].overlapGroupKey, layout.visibleBlocks[1].overlapGroupKey)
})

test('buildDayLayout spreads overlapping blocks across columns', () => {
  const layout = buildDayLayout([
    createBlock('a', 8 * 60, 10 * 60),
    createBlock('b', 9 * 60, 11 * 60),
  ])

  assert.deepEqual(
    layout.visibleBlocks.map((block) => [block.blockId, block.columnIndex, block.visibleColumnCount]),
    [
      ['a', 0, 2],
      ['b', 1, 2],
    ],
  )
  assert.equal(layout.visibleBlocks[0].overlapGroupKey, layout.visibleBlocks[1].overlapGroupKey)
})

test('buildDayLayout reuses a freed column for a later block in the same cluster', () => {
  const layout = buildDayLayout([
    createBlock('long', 8 * 60, 12 * 60),
    createBlock('early', 8 * 60, 9 * 60),
    createBlock('late', 9 * 60, 10 * 60),
  ])

  // Sorting is by start, then end: early (8-9) takes column 0 before long (8-12).
  const columnByBlockId = new Map(layout.visibleBlocks.map((block) => [block.blockId, block.columnIndex]))
  assert.equal(columnByBlockId.get('early'), 0)
  assert.equal(columnByBlockId.get('long'), 1)
  assert.equal(columnByBlockId.get('late'), 0)
  assert.ok(layout.visibleBlocks.every((block) => block.visibleColumnCount === 2))
})

test('buildDayLayout keeps every overlapping block directly visible', () => {
  const blocks = Array.from({ length: 5 }, (_, index) =>
    createBlock(`block-${index}`, 10 * 60, 12 * 60),
  )

  const layout = buildDayLayout(blocks)

  assert.equal(layout.visibleBlocks.length, 5)
  assert.ok(layout.visibleBlocks.every((block) => block.visibleColumnCount === 5))
})

test('buildDayLayout returns empty results for an empty day', () => {
  assert.deepEqual(buildDayLayout([]), { visibleBlocks: [] })
})

test('planner visible boundary ends at 20:00', () => {
  assert.equal(END_HOUR, 20)
})

test('clampPlannerTimeRange truncates blocks at 20:00', () => {
  assert.deepEqual(clampPlannerTimeRange(19 * 60, 22 * 60), {
    startMinutes: 19 * 60,
    endMinutes: 20 * 60,
  })
})

test('clampPlannerTimeRange drops blocks that start at or after 20:00', () => {
  assert.equal(clampPlannerTimeRange(20 * 60, 21 * 60), null)
})

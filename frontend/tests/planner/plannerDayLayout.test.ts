import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlannerBlock } from '../../src/features/planner/utils/plannerFeedback.ts'
import {
  MAX_VISIBLE_OVERLAP_COLUMNS,
  PIXELS_PER_HOUR,
  buildDayLayout,
} from '../../src/features/planner/utils/plannerDayLayout.ts'

function createBlock(id: string, startMinutes: number, endMinutes: number): PlannerBlock {
  return {
    blockId: id,
    slotId: id,
    courseId: id,
    courseTitle: id,
    day: 'Monday',
    startMinutes,
    endMinutes,
    label: '',
    room: '',
    hasOverlap: false,
  }
}

test('buildDayLayout keeps sequential blocks in a single column', () => {
  const layout = buildDayLayout([
    createBlock('a', 8 * 60, 9 * 60),
    createBlock('b', 9 * 60, 10 * 60),
  ])

  assert.equal(layout.overflowIndicators.length, 0)
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

test('buildDayLayout collapses blocks beyond the visible column limit into an overflow indicator', () => {
  const blocks = Array.from({ length: MAX_VISIBLE_OVERLAP_COLUMNS + 2 }, (_, index) =>
    createBlock(`block-${index}`, 10 * 60, 12 * 60),
  )

  const layout = buildDayLayout(blocks)

  assert.equal(layout.visibleBlocks.length, MAX_VISIBLE_OVERLAP_COLUMNS)
  assert.equal(layout.overflowIndicators.length, 1)
  assert.deepEqual(
    layout.overflowIndicators[0].hiddenBlocks.map((block) => block.blockId),
    ['block-3', 'block-4'],
  )
  // Overflow indicator is positioned at the cluster start (10:00 with an 8:00 grid start).
  assert.equal(layout.overflowIndicators[0].top, 2 * PIXELS_PER_HOUR)
})

test('buildDayLayout returns empty results for an empty day', () => {
  assert.deepEqual(buildDayLayout([]), { visibleBlocks: [], overflowIndicators: [] })
})

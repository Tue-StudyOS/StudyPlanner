import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMiniGridBlocks,
  collapseMiniGridBlocksForCalendar,
} from '../../src/features/courses/utils/weeklyScheduleMiniGrid.ts'

test('keeps duplicate schedule entries for the list but collapses same-time calendar blocks', () => {
  const blocks = buildMiniGridBlocks([
    {
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hall N02',
      type: 'Klausur',
    },
    {
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hall N03',
      type: 'Klausur',
    },
    {
      day: 'Tuesday',
      time: '12:00 - 14:00',
      room: 'C 110',
      type: 'Tutorial',
    },
    {
      day: 'Tuesday',
      time: '12:00 - 14:00',
      room: 'C 111',
      type: 'Tutorial',
    },
  ])

  assert.equal(blocks.length, 4)
  assert.deepEqual(
    collapseMiniGridBlocksForCalendar(blocks).map((block) => block.room),
    ['Hall N02', 'C 110'],
  )
})

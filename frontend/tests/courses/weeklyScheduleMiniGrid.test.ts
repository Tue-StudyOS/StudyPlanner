import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMiniGridBlocks,
  compareMiniGridListEntries,
} from '../../src/features/courses/utils/weeklyScheduleMiniGrid.ts'

test('compareMiniGridListEntries orders exam slots by date with Klausur before Nachklausur', () => {
  const blocks = buildMiniGridBlocks([
    {
      day: '29.09.2026',
      time: '09:00 - 12:00',
      room: 'Hörsaal 25',
      type: 'Nachklausur',
    },
    {
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hörsaal N02',
      type: 'Klausur',
    },
    {
      day: '27.07.2026',
      time: '14:00 - 17:00',
      room: 'Hörsaal N03',
      type: 'Nachklausur',
    },
  ])

  const sorted = [...blocks].sort(compareMiniGridListEntries)
  assert.equal(sorted[0]?.slotKind, 'exam')
  assert.equal(sorted[1]?.slotKind, 'resit')
  assert.equal(sorted[2]?.slotKind, 'resit')
  assert.match(sorted[0]?.examDate ?? '', /27\.07\.2026/)
  assert.match(sorted[2]?.examDate ?? '', /29\.09\.2026/)
})

test('compareMiniGridListEntries keeps weekly slots before exam slots', () => {
  const blocks = buildMiniGridBlocks([
    {
      day: '27.07.2026',
      time: '08:00 - 11:00',
      room: 'Hörsaal N02',
      type: 'Klausur',
    },
    {
      day: '13.04.2026 - 20.07.2026',
      time: '10:00 - 12:00',
      room: 'Hörsaal N06',
      type: 'Vorlesung',
    },
  ])

  const sorted = [...blocks].sort(compareMiniGridListEntries)
  assert.equal(sorted[0]?.slotKind, 'weekly')
  assert.equal(sorted[1]?.slotKind, 'exam')
})

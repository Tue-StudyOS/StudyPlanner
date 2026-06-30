import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSemesterBlocks,
  canAddEmptySemester,
  nextEmptySemesterLabel,
} from '../../src/features/test/utils/semesterBlocks.ts'

test('buildSemesterBlocks sorts chronologically and marks empties', () => {
  const blocks = buildSemesterBlocks(
    [
      { semesterLabel: 'WS 2022/23', courseCount: 3 },
      { semesterLabel: 'SS 2022', courseCount: 0 },
    ],
    'WS 2021/22',
    null,
  )
  assert.deepEqual(
    blocks.map((block) => block.label),
    ['WS 2021/22', 'SS 2022', 'WS 2022/23'],
  )
  assert.equal(blocks[0].isEmpty, true) // start semester, no plan
  assert.equal(blocks[1].isEmpty, true) // saved plan with zero courses
  assert.equal(blocks[2].isEmpty, false)
})

test('buildSemesterBlocks includes the freshly added empty block once', () => {
  const blocks = buildSemesterBlocks(
    [{ semesterLabel: 'WS 2021/22', courseCount: 2 }],
    'WS 2021/22',
    'SS 2022',
  )
  assert.deepEqual(
    blocks.map((block) => block.label),
    ['WS 2021/22', 'SS 2022'],
  )
  assert.equal(blocks[1].isEmpty, true)
})

test('canAddEmptySemester is false while any empty block exists', () => {
  assert.equal(
    canAddEmptySemester([{ label: 'WS 2021/22', courseCount: 2, isEmpty: false, isHistorical: false }]),
    true,
  )
  assert.equal(
    canAddEmptySemester([{ label: 'SS 2022', courseCount: 0, isEmpty: true, isHistorical: false }]),
    false,
  )
})

test('buildSemesterBlocks marks historical semesters from completed courses', () => {
  const blocks = buildSemesterBlocks(
    [{ semesterLabel: 'WS 2022/23', courseCount: 3 }],
    null,
    null,
    [
      { semesterLabel: 'WS 2021/22', courseCount: 2 },
      { semesterLabel: 'SS 2022', courseCount: 1 },
    ],
  )
  assert.deepEqual(
    blocks.map((b) => b.label),
    ['WS 2021/22', 'SS 2022', 'WS 2022/23'],
  )
  assert.equal(blocks[0].isHistorical, true)
  assert.equal(blocks[1].isHistorical, true)
  assert.equal(blocks[2].isHistorical, false)
  assert.equal(blocks[0].isEmpty, false)
  assert.equal(blocks[0].courseCount, 2)
})

test('nextEmptySemesterLabel steps one semester past the latest block', () => {
  const blocks = buildSemesterBlocks([{ semesterLabel: 'WS 2021/22', courseCount: 2 }], null, null)
  assert.equal(nextEmptySemesterLabel(blocks, 'WS 2021/22'), 'SS 2022')
  assert.equal(nextEmptySemesterLabel([], 'WS 2021/22'), 'WS 2021/22')
})

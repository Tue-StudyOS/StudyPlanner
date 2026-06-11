import assert from 'node:assert/strict'
import test from 'node:test'
import { getLecturePeriod } from '../../src/features/planner/utils/lecturePeriod.ts'

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('SoSe 2026 matches the official anchor dates', () => {
  const period = getLecturePeriod('SS 2026')
  assert.ok(period)
  assert.equal(toIsoDate(period.start), '2026-04-13')
  assert.equal(toIsoDate(period.end), '2026-07-25')
})

test('winter periods run from the second October Monday to the last February Saturday', () => {
  const period = getLecturePeriod('WS 2026/27')
  assert.ok(period)
  assert.equal(toIsoDate(period.start), '2026-10-12')
  assert.equal(period.start.getDay(), 1)
  assert.equal(toIsoDate(period.end), '2027-02-27')
  assert.equal(period.end.getDay(), 6)
})

test('start days are always Mondays and end days always Saturdays', () => {
  for (const label of ['SS 2024', 'SS 2025', 'WS 2024/25', 'WS 2025/26']) {
    const period = getLecturePeriod(label)
    assert.ok(period, label)
    assert.equal(period.start.getDay(), 1, `${label} start`)
    assert.equal(period.end.getDay(), 6, `${label} end`)
  }
})

test('unparseable labels return null', () => {
  assert.equal(getLecturePeriod('Semester 1'), null)
  assert.equal(getLecturePeriod(''), null)
})

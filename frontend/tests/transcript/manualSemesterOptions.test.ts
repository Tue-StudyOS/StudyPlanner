import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildManualSemesterOptions,
  getManualSemesterDefault,
} from '../../src/features/transcript/utils/manualSemesterOptions.ts'

test('buildManualSemesterOptions counts from the stored start semester to the next upcoming semester', () => {
  const options = buildManualSemesterOptions('WS 2024/25', new Date(2026, 5, 10))
  assert.deepEqual(options, ['WS 2024/25', 'SS 2025', 'WS 2025/26', 'SS 2026', 'WS 2026/27'])
})

test('buildManualSemesterOptions falls back to current and next semester for invalid starts', () => {
  const options = buildManualSemesterOptions('SoSe 2026', new Date(2026, 5, 10))
  assert.deepEqual(options, ['SS 2026', 'WS 2026/27'])
})

test('getManualSemesterDefault keeps a valid stored start and otherwise uses the first option', () => {
  const options = ['WS 2024/25', 'SS 2025']
  assert.equal(getManualSemesterDefault('WS 2024/25', options), 'WS 2024/25')
  assert.equal(getManualSemesterDefault('SS 2026', options), 'WS 2024/25')
})

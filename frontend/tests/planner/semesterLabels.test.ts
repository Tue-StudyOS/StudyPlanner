import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSemesterOptions,
  compareSemesterLabels,
  formatSemesterLabelShort,
  formatSemesterLabelDisplay,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
  parseSemesterLabel,
  setSimulatedCurrentSemesterLabel,
} from '../../src/features/planner/utils/semesterLabels.ts'

test('parseSemesterLabel parses summer and winter labels', () => {
  assert.deepEqual(parseSemesterLabel('SS 2025'), { term: 'SS', year: 2025 })
  assert.deepEqual(parseSemesterLabel('WS 2024/25'), { term: 'WS', year: 2024 })
  assert.deepEqual(parseSemesterLabel('ws 2024 / 2025'), { term: 'WS', year: 2024 })
  assert.equal(parseSemesterLabel('Sommersemester 2025'), null)
  assert.equal(parseSemesterLabel(null), null)
})

test('formatSemesterLabelShort shortens valid labels and passes through invalid ones', () => {
  assert.equal(formatSemesterLabelShort('SS 2025'), 'SS 25')
  assert.equal(formatSemesterLabelShort('WS 2024/25'), 'WS 24/25')
  assert.equal(formatSemesterLabelShort('custom label'), 'custom label')
})

test('formatSemesterLabelDisplay keeps full year labels for hub cards', () => {
  assert.equal(formatSemesterLabelDisplay('SS 2023'), 'SS 2023')
  assert.equal(formatSemesterLabelDisplay('WS 2022/23'), 'WS 2022/23')
})

test('compareSemesterLabels orders semesters chronologically', () => {
  assert.ok(compareSemesterLabels('SS 2024', 'WS 2024/25') < 0)
  assert.ok(compareSemesterLabels('WS 2024/25', 'SS 2025') < 0)
  assert.equal(compareSemesterLabels('SS 2025', 'SS 2025'), 0)
})

test('getCurrentSemesterLabel maps months to semesters', () => {
  assert.equal(getCurrentSemesterLabel(new Date(2026, 5, 10)), 'SS 2026')
  assert.equal(getCurrentSemesterLabel(new Date(2026, 0, 15)), 'WS 2025/26')
  assert.equal(getCurrentSemesterLabel(new Date(2025, 9, 5)), 'WS 2025/26')
})

test('getRelativeSemesterLabel steps forwards and backwards', () => {
  assert.equal(getRelativeSemesterLabel('SS 2025', 1), 'WS 2025/26')
  assert.equal(getRelativeSemesterLabel('WS 2025/26', 1), 'SS 2026')
  assert.equal(getRelativeSemesterLabel('SS 2025', -1), 'WS 2024/25')
  assert.equal(getRelativeSemesterLabel('not a semester', 1), 'not a semester')
})

test('buildSemesterOptions builds a sorted range around the fallback label', () => {
  const options = buildSemesterOptions([], 'SS 2025')
  assert.deepEqual(options, ['SS 2024', 'WS 2024/25', 'SS 2025', 'WS 2025/26'])
})

test('buildSemesterOptions keeps extra labels inside the range and drops outliers', () => {
  const options = buildSemesterOptions(['WS 2024/25', 'SS 2010'], 'SS 2025')
  assert.deepEqual(options, ['SS 2024', 'WS 2024/25', 'SS 2025', 'WS 2025/26'])
})

test('setSimulatedCurrentSemesterLabel overrides the date-derived current semester', () => {
  try {
    setSimulatedCurrentSemesterLabel('SS 2025')
    assert.equal(getCurrentSemesterLabel(new Date(2026, 5, 10)), 'SS 2025')
    // An invalid label is ignored and clears the override.
    setSimulatedCurrentSemesterLabel('not a semester')
    assert.equal(getCurrentSemesterLabel(new Date(2026, 5, 10)), 'SS 2026')
  } finally {
    setSimulatedCurrentSemesterLabel(null)
  }
})

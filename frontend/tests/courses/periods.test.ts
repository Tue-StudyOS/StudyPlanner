import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findCatalogPeriodForSemesterLabel,
  semesterLabelToPeriodLabel,
} from '../../src/features/courses/utils/periods.ts'

const PERIODS = [
  { periodId: '229', label: 'Sommer 2026', courseCount: 122 },
  { periodId: '236', label: 'Winter 2025/26', courseCount: 131 },
  { periodId: '225', label: 'Sommer 2022', courseCount: 59 },
]

test('semesterLabelToPeriodLabel translates planner labels to ALMA period labels', () => {
  assert.equal(semesterLabelToPeriodLabel('SS 2026'), 'Sommer 2026')
  assert.equal(semesterLabelToPeriodLabel('WS 2025/26'), 'Winter 2025/26')
  assert.equal(semesterLabelToPeriodLabel('ws 2025 / 2026'), 'Winter 2025/26')
  assert.equal(semesterLabelToPeriodLabel('  ss 2022 '), 'Sommer 2022')
})

test('semesterLabelToPeriodLabel rejects labels in other formats', () => {
  assert.equal(semesterLabelToPeriodLabel('Sommersemester 2026'), null)
  assert.equal(semesterLabelToPeriodLabel('2026'), null)
  assert.equal(semesterLabelToPeriodLabel(''), null)
})

test('findCatalogPeriodForSemesterLabel matches the period with the translated label', () => {
  assert.equal(findCatalogPeriodForSemesterLabel(PERIODS, 'SS 2026')?.periodId, '229')
  assert.equal(findCatalogPeriodForSemesterLabel(PERIODS, 'WS 2025/26')?.periodId, '236')
})

test('findCatalogPeriodForSemesterLabel returns null when the catalog lacks the semester', () => {
  assert.equal(findCatalogPeriodForSemesterLabel(PERIODS, 'WS 2026/27'), null)
  assert.equal(findCatalogPeriodForSemesterLabel([], 'SS 2026'), null)
})

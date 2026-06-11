import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOfferingStatus,
  isCompulsoryCourse,
  parsePeriodLabel,
} from '../../src/features/courses/utils/catalogOffering.ts'
import type { StudyAreaOption } from '../../src/features/courses/types.ts'

// Newest catalog data: Sommer 2026 and Winter 2025/26.
const KNOWN_PERIODS = ['Sommer 2026', 'Winter 2025/26', 'Sommer 2025', 'Winter 2024/25']
// A date inside the summer semester 2026.
const NOW = new Date('2026-06-12T12:00:00')

function buildAreaOption(overrides: Partial<StudyAreaOption>): StudyAreaOption {
  return {
    programCode: 'INFO-MSC',
    programName: 'Informatik MSc',
    studyAreaCode: 'INFO-PRAK',
    studyAreaName: 'Praktische Informatik',
    areaType: null,
    optionStatus: 'allowed',
    ectsCounted: null,
    moduleCode: null,
    moduleTitle: null,
    ...overrides,
  }
}

test('parsePeriodLabel reads ALMA period labels', () => {
  assert.deepEqual(parsePeriodLabel('Sommer 2026'), { season: 'summer', startYear: 2026 })
  assert.deepEqual(parsePeriodLabel('Winter 2025/26'), { season: 'winter', startYear: 2025 })
  assert.equal(parsePeriodLabel('Blockkurs März'), null)
})

test('a course with data for the current summer term is confirmed', () => {
  const course = { offeredPeriods: ['Sommer 2026', 'Sommer 2025'], studyAreaOptions: [] }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'confirmed')
})

test('a winter course that ran in the most recent winter catalog is likely for next winter', () => {
  // Target winter is 2026/27 but the newest winter data is 2025/26.
  const course = { offeredPeriods: ['Winter 2025/26', 'Winter 2024/25'], studyAreaOptions: [] }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'likely')
})

test('a winter course that skipped the most recent winter catalog is unknown', () => {
  const course = { offeredPeriods: ['Winter 2024/25'], studyAreaOptions: [] }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'unknown')
})

test('a summer course missing from the current summer catalog is unknown', () => {
  const course = { offeredPeriods: ['Sommer 2025'], studyAreaOptions: [] }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'unknown')
})

test('the best season wins for courses offered in both terms', () => {
  const course = {
    offeredPeriods: ['Sommer 2026', 'Winter 2024/25'],
    studyAreaOptions: [],
  }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'confirmed')
})

test('compulsory courses are always offered', () => {
  const course = {
    offeredPeriods: ['Winter 2024/25'],
    studyAreaOptions: [buildAreaOption({ optionStatus: 'mandatory' })],
  }
  assert.equal(getOfferingStatus(course, KNOWN_PERIODS, NOW), 'always')
})

test('isCompulsoryCourse detects Pflicht markers from the regulation mapping', () => {
  assert.equal(isCompulsoryCourse({ studyAreaOptions: [buildAreaOption({ optionStatus: 'mandatory' })] }), true)
  assert.equal(isCompulsoryCourse({ studyAreaOptions: [buildAreaOption({ areaType: 'pflicht' })] }), true)
  assert.equal(isCompulsoryCourse({ studyAreaOptions: [buildAreaOption({ studyAreaCode: 'INF' })] }), true)
  assert.equal(isCompulsoryCourse({ studyAreaOptions: [buildAreaOption({})] }), false)
  assert.equal(isCompulsoryCourse({ studyAreaOptions: [] }), false)
})

test('courses without any offering data are unknown', () => {
  assert.equal(getOfferingStatus({ offeredPeriods: [], studyAreaOptions: [] }, KNOWN_PERIODS, NOW), 'unknown')
  assert.equal(getOfferingStatus({ studyAreaOptions: [] }, KNOWN_PERIODS, NOW), 'unknown')
})

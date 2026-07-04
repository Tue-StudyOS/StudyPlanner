import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDetailSeasonTermType,
  getLatestKnownSeasonTermType,
  getOfferingStatus,
  getOutdatedOfferingSortRank,
  getRecentSeasonTermType,
  isCompulsoryCourse,
  isDefaultVisibleOfferingStatus,
  isOutdatedOfferingStatus,
  parsePeriodLabel,
  resolveUnconfirmedOfferingVisibility,
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

test('getLatestKnownSeasonTermType uses the newest known catalog period for each selected season', () => {
  assert.equal(
    getLatestKnownSeasonTermType({ offeredPeriods: ['Sommer 2026', 'Winter 2025/26'] }, KNOWN_PERIODS),
    'both',
  )
  assert.equal(getLatestKnownSeasonTermType({ offeredPeriods: ['Sommer 2026'] }, KNOWN_PERIODS), 'summer')
  assert.equal(getLatestKnownSeasonTermType({ offeredPeriods: ['Winter 2025/26'] }, KNOWN_PERIODS), 'winter')
  assert.equal(getLatestKnownSeasonTermType({ offeredPeriods: ['Winter 2024/25'] }, KNOWN_PERIODS), 'unknown')
  assert.equal(getLatestKnownSeasonTermType({ offeredPeriods: ['Sommer 2025'] }, KNOWN_PERIODS), 'unknown')
})

test('catalog offering display helpers keep likely courses in normal order', () => {
  assert.equal(isDefaultVisibleOfferingStatus('always'), true)
  assert.equal(isDefaultVisibleOfferingStatus('confirmed'), true)
  assert.equal(isDefaultVisibleOfferingStatus(undefined), true)
  assert.equal(isDefaultVisibleOfferingStatus('likely'), false)
  assert.equal(isDefaultVisibleOfferingStatus('unknown'), false)

  assert.equal(isOutdatedOfferingStatus('likely'), false)
  assert.equal(isOutdatedOfferingStatus('unknown'), true)
  assert.equal(getOutdatedOfferingSortRank('confirmed'), 0)
  assert.equal(getOutdatedOfferingSortRank('likely'), 0)
  assert.equal(getOutdatedOfferingSortRank('unknown'), 1)
})

test('onboarding keeps unconfirmed course examples visible regardless of the checkbox draft state', () => {
  assert.equal(resolveUnconfirmedOfferingVisibility(false, false), false)
  assert.equal(resolveUnconfirmedOfferingVisibility(true, false), true)
  assert.equal(resolveUnconfirmedOfferingVisibility(false, true), true)
  assert.equal(resolveUnconfirmedOfferingVisibility(true, true), true)
})

// During summer term 2026 the last *completed* semesters are Sommer 2025 and
// Winter 2025/26; the running Sommer 2026 does not count yet.
test('getRecentSeasonTermType tags the last completed same-season semester during summer', () => {
  assert.equal(
    getRecentSeasonTermType({ offeredPeriods: ['Sommer 2025', 'Winter 2025/26'] }, NOW),
    'both',
  )
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Sommer 2025'] }, NOW), 'summer')
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Winter 2025/26'] }, NOW), 'winter')
})

test('getRecentSeasonTermType ignores the currently running term and older offerings', () => {
  // Sommer 2026 is still running -> no summer tag yet.
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Sommer 2026'] }, NOW), 'unknown')
  // Two summers back is too old.
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Sommer 2024'] }, NOW), 'unknown')
  // Winter that ended over a year ago is too old.
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Winter 2024/25'] }, NOW), 'unknown')
  assert.equal(getRecentSeasonTermType({ offeredPeriods: [] }, NOW), 'unknown')
})

test('getRecentSeasonTermType shifts the reference window during a winter term', () => {
  // Mid-January 2026 -> running term is Winter 2025/26. Last completed are
  // Sommer 2025 and Winter 2024/25.
  const winterNow = new Date('2026-01-15T12:00:00')
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Sommer 2025'] }, winterNow), 'summer')
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Winter 2024/25'] }, winterNow), 'winter')
  // The running winter does not count yet.
  assert.equal(getRecentSeasonTermType({ offeredPeriods: ['Winter 2025/26'] }, winterNow), 'unknown')
})

test('getDetailSeasonTermType shows both when catalog termType or offered periods cover both seasons', () => {
  assert.equal(
    getDetailSeasonTermType({ termType: 'both', offeredPeriods: [] }, NOW),
    'both',
  )
  assert.equal(
    getDetailSeasonTermType({
      termType: 'summer',
      offeredPeriods: ['Sommer 2025', 'Winter 2025/26'],
    }, NOW),
    'both',
  )
  assert.equal(
    getDetailSeasonTermType({ termType: 'winter', offeredPeriods: ['Winter 2025/26'] }, NOW),
    'winter',
  )
})

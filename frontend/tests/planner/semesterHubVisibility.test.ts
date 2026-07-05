import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getLatestSelectableSemesterLabel,
  getUpcomingSemesterHubVisibilityDate,
  isUpcomingSemesterHubVisible,
} from '../../src/features/planner/utils/semesterHubVisibility.ts'
import { setSimulatedCurrentSemesterLabel } from '../../src/features/planner/utils/semesterLabels.ts'

function formatLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

test('getUpcomingSemesterHubVisibilityDate is two months before lecture start', () => {
  assert.equal(
    formatLocalIsoDate(getUpcomingSemesterHubVisibilityDate('SS 2026')!),
    '2026-02-13',
  )
  assert.equal(
    formatLocalIsoDate(getUpcomingSemesterHubVisibilityDate('WS 2026/27')!),
    '2026-08-12',
  )
})

test('isUpcomingSemesterHubVisible hides the next semester until two months before start', () => {
  try {
    setSimulatedCurrentSemesterLabel('SS 2026')
    assert.equal(isUpcomingSemesterHubVisible('SS 2026', new Date(2026, 6, 5)), true)
    assert.equal(isUpcomingSemesterHubVisible('WS 2025/26', new Date(2026, 6, 5)), true)
    assert.equal(isUpcomingSemesterHubVisible('WS 2026/27', new Date(2026, 6, 5)), false)
    assert.equal(isUpcomingSemesterHubVisible('WS 2026/27', new Date(2026, 7, 15)), true)
  } finally {
    setSimulatedCurrentSemesterLabel(null)
  }
})

test('getLatestSelectableSemesterLabel follows the visibility window', () => {
  try {
    setSimulatedCurrentSemesterLabel('SS 2026')
    assert.equal(getLatestSelectableSemesterLabel(new Date(2026, 6, 5)), 'SS 2026')
    assert.equal(getLatestSelectableSemesterLabel(new Date(2026, 7, 15)), 'WS 2026/27')
  } finally {
    setSimulatedCurrentSemesterLabel(null)
  }
})

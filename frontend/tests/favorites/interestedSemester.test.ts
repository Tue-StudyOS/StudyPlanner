import assert from 'node:assert/strict'
import test from 'node:test'
import {
  interestedCatalogPath,
  resolveInterestedSemester,
} from '../../src/features/favorites/utils/interestedSemester.ts'
import { setSimulatedCurrentSemesterLabel } from '../../src/features/planner/utils/semesterLabels.ts'

const august = new Date(2026, 7, 31, 23, 59)
const september = new Date(2026, 8, 1)

test('catalog stars move to a fresh scope when the planning window opens', () => {
  assert.equal(resolveInterestedSemester('/catalog', '', august), 'SS 2026')
  assert.equal(resolveInterestedSemester('/catalog', '', september), 'WS 2026/27')
  assert.equal(resolveInterestedSemester('/catalog', '', new Date(2027, 1, 28)), 'WS 2026/27')
  assert.equal(resolveInterestedSemester('/catalog', '', new Date(2027, 2, 1)), 'SS 2027')
})

test('explicit semester plans use their own list, not the catalog default', () => {
  assert.equal(resolveInterestedSemester('/semester/SS%202026', '', september), 'SS 2026')
  assert.equal(resolveInterestedSemester('/semester/WS%202025%2F26', '', september), 'WS 2025/26')
  assert.equal(resolveInterestedSemester('/semester/SS%202027', '', september), 'SS 2027')
})

test('archived catalog links and their detail drawers preserve the selected semester', () => {
  const path = interestedCatalogPath('WS 2025/26')
  assert.equal(path, '/catalog?semester=WS%202025%2F26')
  const search = path.slice(path.indexOf('?'))
  assert.equal(resolveInterestedSemester('/catalog', search, september), 'WS 2025/26')
  assert.equal(resolveInterestedSemester('/catalog/42', search, september), 'WS 2025/26')
  assert.equal(resolveInterestedSemester('/semester', search, september), 'WS 2026/27')
})

test('invalid routes and empty semester selections fall back safely', () => {
  assert.equal(resolveInterestedSemester('/semester/%E0%A4%A', '', september), 'WS 2026/27')
  assert.equal(resolveInterestedSemester('/catalog', '?semester=not-a-semester', september), 'WS 2026/27')
  assert.equal(resolveInterestedSemester('/catalog', '?semester=', september), 'WS 2026/27')
})

test('semester simulation uses the same scope for catalog stars and planning', () => {
  try {
    setSimulatedCurrentSemesterLabel('SS 2025')
    assert.equal(resolveInterestedSemester('/catalog', '', september), 'SS 2025')
    assert.equal(resolveInterestedSemester('/semester/SS%202026', '', september), 'SS 2026')
  } finally {
    setSimulatedCurrentSemesterLabel(null)
  }
})

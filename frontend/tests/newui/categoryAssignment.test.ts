import assert from 'node:assert/strict'
import test from 'node:test'
import type { RegulationAreaProgress } from '../../src/features/dashboard/types.ts'
import {
  buildCategoryAreaMap,
  selectableCategoriesFromMap,
} from '../../src/features/newui/utils/categoryAssignment.ts'

function area(overrides: Partial<RegulationAreaProgress> & Pick<RegulationAreaProgress, 'code'>): RegulationAreaProgress {
  return {
    name: overrides.code,
    requiredEcts: 18,
    earnedEcts: 0,
    masterCat: null,
    ...overrides,
  }
}

const REGULATION: RegulationAreaProgress[] = [
  area({ code: 'TECH', masterCat: 'TECH' }),
  area({ code: 'THEO', masterCat: 'THEO' }),
  area({ code: 'PRAK', masterCat: 'PRAK' }),
  area({ code: 'INFO', masterCat: 'INFO' }),
  area({ code: 'FOKUS', masterCat: 'BASIS' }),
  area({ code: 'THESIS', masterCat: null, requiredEcts: 30 }),
]

test('maps every regulation category to a valid study-area code', () => {
  const map = buildCategoryAreaMap(REGULATION)
  assert.equal(map.get('TECH'), 'TECH')
  assert.equal(map.get('INFO'), 'INFO')
  // FOKUS has no code-derived category, so its backend category (BASIS) is used.
  assert.equal(map.get('BASIS'), 'FOKUS')
  // The thesis has no category and must not become selectable.
  assert.equal(map.has('THESIS' as never), false)
})

test('prefers the raw rule-group code over a merged display code', () => {
  const map = buildCategoryAreaMap([
    area({ code: 'INF-MERGED', masterCat: 'INFO', rawAreaCodes: ['INFO'] }),
  ])
  assert.equal(map.get('INFO'), 'INFO')
})

test('lists selectable categories in canonical order', () => {
  const map = buildCategoryAreaMap(REGULATION)
  assert.deepEqual(selectableCategoriesFromMap(map), ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS'])
})

test('returns no categories for an empty regulation', () => {
  assert.deepEqual(selectableCategoriesFromMap(buildCategoryAreaMap([])), [])
})

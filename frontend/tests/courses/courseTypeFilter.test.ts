import assert from 'node:assert/strict'
import test from 'node:test'
import { courseMatchesTypeFilter } from '../../src/features/courses/utils/courseTypeFilter.ts'

const LECTURE = { types: ['Vorlesung', 'Übung'], courseType: 'Vorlesung' }
const SEMINAR = { types: ['Hauptseminar'], courseType: 'Hauptseminar' }
const PRACTICAL = { types: [], courseType: 'Blockpraktikum' }

test('no selection matches everything', () => {
  assert.equal(courseMatchesTypeFilter(LECTURE, []), true)
})

test('matches when any type keyword fits', () => {
  assert.equal(courseMatchesTypeFilter(LECTURE, ['lecture']), true)
  assert.equal(courseMatchesTypeFilter(LECTURE, ['exercise']), true)
  assert.equal(courseMatchesTypeFilter(SEMINAR, ['seminar']), true)
  assert.equal(courseMatchesTypeFilter(PRACTICAL, ['practical']), true)
})

test('rejects when no selected group fits', () => {
  assert.equal(courseMatchesTypeFilter(SEMINAR, ['lecture', 'practical']), false)
  assert.equal(courseMatchesTypeFilter(LECTURE, ['colloquium']), false)
})

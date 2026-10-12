import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course } from '../../src/features/courses/types.ts'
import { getCourseEctsLabel, resolveCourseEcts } from '../../src/features/courses/utils/courseEcts.ts'

function course(ects: number | null = null): Course {
  return { ects, ectsSource: 'catalog_tree', ectsTreeOptions: [
    { programCode: 'MSC_INFO_2021', ects: 9, sourceLabels: ['Master (9 CP)'] },
    { programCode: 'BSC_BIOINFO_2021', ects: 6, sourceLabels: ['Bachelor (6 CP)'] },
  ] } as Course
}

test('credits follow the selected program without mutating cached data', () => {
  const original = course()
  assert.equal(resolveCourseEcts(original, 'MSC_INFO_2021').ects, 9)
  assert.equal(resolveCourseEcts(original, 'bsc_bioinfo_2021').ects, 6)
  assert.equal(original.ects, null)
  assert.equal(resolveCourseEcts(original).ects, null)
  assert.equal(resolveCourseEcts(original, 'UNKNOWN').ects, null)
})

test('conflicting values within one program stay unknown', () => {
  const original = course()
  original.ectsTreeOptions?.push({ programCode: 'MSC_INFO_2021', ects: 6, sourceLabels: ['Other group'] })
  assert.equal(resolveCourseEcts(original, 'MSC_INFO_2021').ects, null)
})

test('unambiguous tree credits work without a selected program', () => {
  const original = course()
  original.ectsTreeOptions = [original.ectsTreeOptions![0]]
  assert.equal(resolveCourseEcts(original).ects, 9)
})

test('explicit values and unsupported courses remain unchanged', () => {
  const explicit = { ...course(3), ectsSource: null }
  assert.equal(resolveCourseEcts(explicit, 'MSC_INFO_2021'), explicit)
  const unknown = { ects: null } as Course
  assert.equal(resolveCourseEcts(unknown, 'MSC_INFO_2021'), unknown)
})

test('ambiguous credits are visible without assigning a numeric value', () => {
  const unresolved = resolveCourseEcts(course())
  assert.equal(unresolved.ects, null)
  assert.equal(getCourseEctsLabel(unresolved), '6 / 9')
  assert.equal(getCourseEctsLabel(resolveCourseEcts(course(), 'MSC_INFO_2021')), '9')
  assert.equal(getCourseEctsLabel(resolveCourseEcts(course(), 'BSC_BIOINFO_2021')), '6')
})

test('unmatched programs retain published evidence without assigning planner credits', () => {
  const unmatched = resolveCourseEcts(course(), 'MSC_ML_2021')
  assert.equal(unmatched.ects, null)
  assert.equal(unmatched.ectsProgramMatched, false)
  assert.equal(getCourseEctsLabel(unmatched), '6 / 9')
})

test('a single published value remains visible for an unmatched program', () => {
  const original = course()
  original.ectsTreeOptions = [original.ectsTreeOptions![0]]
  const unmatched = resolveCourseEcts(original, 'MSC_ML_2021')
  assert.equal(unmatched.ects, null)
  assert.equal(unmatched.ectsProgramMatched, false)
  assert.equal(getCourseEctsLabel(unmatched), '9')
})

test('courses without evidence still have no invented credit label', () => {
  assert.equal(getCourseEctsLabel({ ects: null } as Course), null)
  assert.equal(getCourseEctsLabel({ ects: 7.5 } as Course), '7.5')
})

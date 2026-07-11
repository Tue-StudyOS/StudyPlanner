import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyAreaOption } from '../../src/features/courses/types.ts'
import { dedupeStudyAreaOptions } from '../../src/features/courses/utils/studyAreaOptions.ts'

function option(overrides: Partial<StudyAreaOption> = {}): StudyAreaOption {
  return {
    programCode: 'BSC_INFO_2021',
    programName: 'B.Sc. Informatik',
    studyAreaCode: 'MATH',
    studyAreaName: 'Pflichtstudienbereich Mathematik',
    areaType: 'pflicht',
    optionStatus: 'allowed',
    ectsCounted: null,
    moduleCode: null,
    moduleTitle: null,
    ...overrides,
  }
}

test('dedupeStudyAreaOptions shows one mapping per program area', () => {
  const generic = option()
  const moduleMapping = option({
    optionStatus: 'required',
    ectsCounted: 6,
    moduleCode: 'INFM2020',
    moduleTitle: 'Mathematik fuer Informatik 4',
  })

  assert.deepEqual(dedupeStudyAreaOptions([generic, moduleMapping]), [moduleMapping])
})

test('dedupeStudyAreaOptions keeps mappings for different programs and areas', () => {
  const math = option()
  const main = option({ studyAreaCode: 'INF', studyAreaName: 'Pflichtstudienbereich Informatik' })
  const masterMath = option({ programCode: 'MSC_INFO_2021' })

  assert.deepEqual(dedupeStudyAreaOptions([math, main, masterMath]), [math, main, masterMath])
})

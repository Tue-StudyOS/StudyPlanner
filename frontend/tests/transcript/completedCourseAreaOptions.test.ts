import assert from 'node:assert/strict'
import test from 'node:test'
import type { RegulationRuleGroup } from '../../src/shared/utils/regulation.ts'
import {
  buildCompletedCourseAreaOptions,
  completedCourseAreaLabel,
} from '../../src/features/transcript/utils/completedCourseAreaOptions.ts'

const RULE_GROUPS: RegulationRuleGroup[] = [
  { code: 'INF', name: 'Pflichtbereich', groupType: 'pflicht', requiredEcts: 30 },
  { code: 'INFO-PRAK', name: 'Praktische Informatik', groupType: 'elective_area', requiredEcts: 18 },
  { code: 'INFO-TECH', name: 'Technische Informatik', groupType: 'elective_area', requiredEcts: 18 },
  { code: 'UEBK', name: 'Überfachliche Kompetenzen', groupType: 'elective_area', requiredEcts: 6 },
]

test('catalog courses keep the server assignable areas and the current assignment', () => {
  const options = buildCompletedCourseAreaOptions(
    {
      courseId: '42',
      studyAreaCode: 'INF',
      studyAreaName: 'Pflichtbereich',
      availableStudyAreaOptions: [
        { studyAreaCode: 'INFO-PRAK', studyAreaName: 'Praktische Informatik', groupType: 'elective_area' },
        { studyAreaCode: 'INFO-TECH', studyAreaName: 'Technische Informatik', groupType: 'elective_area' },
      ],
    },
    RULE_GROUPS,
  )

  assert.deepEqual(options.map((option) => option.code), ['INFO-PRAK', 'INFO-TECH', 'INF'])
  assert.equal(options[0]?.label, 'INFO-PRAK · Praktische Informatik')
  assert.equal(options[2]?.shortLabel, 'MAIN')
})

test('custom courses can move to any flexible regulation area', () => {
  const options = buildCompletedCourseAreaOptions(
    {
      courseId: null,
      studyAreaCode: 'INFO-PRAK',
      studyAreaName: 'Praktische Informatik',
      availableStudyAreaOptions: [
        { studyAreaCode: 'INFO-PRAK', studyAreaName: 'Praktische Informatik', groupType: 'elective_area' },
      ],
    },
    RULE_GROUPS,
  )

  assert.deepEqual(options.map((option) => option.code), ['INFO-PRAK', 'INFO-TECH', 'UEBK'])
})

test('completedCourseAreaLabel prefers the regulation label for the stored area', () => {
  assert.equal(
    completedCourseAreaLabel(
      {
        courseId: '7',
        studyAreaCode: 'inf',
        studyAreaName: null,
        availableStudyAreaOptions: [],
      },
      RULE_GROUPS,
    ),
    'INF · Pflichtbereich',
  )
  assert.equal(
    completedCourseAreaLabel(
      {
        courseId: '7',
        studyAreaCode: null,
        studyAreaName: null,
        availableStudyAreaOptions: [],
      },
      RULE_GROUPS,
    ),
    null,
  )
})

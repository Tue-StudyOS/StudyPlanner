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

  assert.deepEqual(options.map((option) => option.code), ['INFO-PRAK', 'INFO-TECH', 'INF', 'UEBK'])
  assert.equal(options[0]?.label, 'INFO-PRAK · Praktische Informatik')
  assert.equal(options[2]?.shortLabel, 'MAIN')
})

test('catalog courses can move to any regulation area except the thesis', () => {
  const options = buildCompletedCourseAreaOptions(
    {
      courseId: '42',
      studyAreaCode: 'PRAK',
      studyAreaName: 'Wahlpflichtfach Praktische Informatik',
      availableStudyAreaOptions: [
        { studyAreaCode: 'PRAK', studyAreaName: 'Wahlpflichtfach Praktische Informatik', groupType: 'wahlpflicht' },
      ],
    },
    [
      { code: 'INF', name: 'Pflichtstudienbereich Informatik', groupType: 'pflicht', requiredEcts: 60 },
      { code: 'PRAK', name: 'Wahlpflichtfach Praktische Informatik', groupType: 'wahlpflicht', requiredEcts: 12 },
      { code: 'TECH', name: 'Wahlpflichtfach Technische Informatik', groupType: 'wahlpflicht', requiredEcts: 12 },
      { code: 'THESIS', name: 'Bachelorarbeit', groupType: 'thesis', requiredEcts: 15 },
    ],
  )

  assert.deepEqual(options.map((option) => option.code), ['PRAK', 'INF', 'TECH'])
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

test('compulsory server restrictions do not reintroduce electives or an invalid stored area', () => {
  const course = {
    courseId: '1197', studyAreaCode: 'UEBK', assignmentRestricted: true,
    availableStudyAreaOptions: [{ studyAreaCode: 'INF', studyAreaName: 'Mandatory', groupType: 'pflicht' }],
  }
  assert.deepEqual(buildCompletedCourseAreaOptions(course, RULE_GROUPS).map((option) => option.code), ['INF'])
  assert.deepEqual(buildCompletedCourseAreaOptions({ ...course, assignmentRestricted: false, categoryLocked: true }, RULE_GROUPS)
    .map((option) => option.code), ['INF'])
  const ambiguous = { ...course, availableStudyAreaOptions: [
    ...course.availableStudyAreaOptions,
    { studyAreaCode: 'MATH', studyAreaName: 'Mathematics', groupType: 'pflicht' },
  ] }
  assert.deepEqual(buildCompletedCourseAreaOptions(ambiguous, RULE_GROUPS).map((option) => option.code), ['INF', 'MATH'])
})

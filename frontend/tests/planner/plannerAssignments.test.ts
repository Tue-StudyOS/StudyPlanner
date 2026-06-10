import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompletedCourse, Course } from '../../src/features/courses/index.ts'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../src/shared/utils/regulation.ts'
import {
  getCurrentPlannerAssignment,
  getSuggestedPlannerAssignment,
  resolveAutomaticPlannerAssignments,
  type PlannerAssignmentAreaState,
  type PlannerAutomaticAssignmentCandidate,
} from '../../src/features/planner/utils/plannerAssignments.ts'

const STUDY_PROGRAM_CODE = 'MSC-INFO'

const RULE_GROUPS: RegulationRuleGroup[] = [
  { code: 'A-PRAK', name: 'Practical', groupType: 'elective_area', maxEcts: 12, sortOrder: 1 },
  { code: 'B-THEO', name: 'Theoretical', groupType: 'elective_area', maxEcts: 9, sortOrder: 2 },
  { code: 'C-INFO', name: 'General', groupType: 'elective_area', maxEcts: 6, sortOrder: 3 },
]

function createCourse(overrides: Partial<Course> & { id: string }): Course {
  return {
    number: 'INF0000',
    title: overrides.id,
    lecturer: '',
    room: '',
    types: [],
    ects: 6,
    sws: null,
    masterCats: [],
    weekdays: [],
    schedule: [],
    frequency: '',
    language: 'German',
    prerequisites: [],
    description: '',
    exams: [],
    ...overrides,
  }
}

function createStudyAreaOption(studyAreaCode: string) {
  return {
    programCode: STUDY_PROGRAM_CODE,
    programName: null,
    studyAreaCode,
    studyAreaName: null,
    areaType: null,
    optionStatus: 'active',
    ectsCounted: null,
    moduleCode: null,
    moduleTitle: null,
  }
}

function createCompletedCourse(overrides: Partial<CompletedCourse> & { id: string }): CompletedCourse {
  return {
    title: overrides.id,
    ects: 6,
    masterCat: 'PRAK',
    grade: 2.0,
    semester: 'WS 2025/26',
    ...overrides,
  }
}

function createAreaOption(code: string): RegulationAreaOption {
  return {
    code,
    label: code,
    shortLabel: code,
    masterCat: null,
    isFlexible: true,
  }
}

function createAreaState(
  code: string,
  capacityEcts: number | null,
  creditedEcts = 0,
): PlannerAssignmentAreaState {
  return { code, capacityEcts, creditedEcts, plannedEcts: 0 }
}

test('getCurrentPlannerAssignment auto-assigns a single mapped area', () => {
  const course = createCourse({
    id: 'single-area',
    masterCats: ['PRAK'],
    studyAreaOptions: [createStudyAreaOption('A-PRAK')],
  })

  const assignment = getCurrentPlannerAssignment(course, {
    studyProgramCode: STUDY_PROGRAM_CODE,
    regulationRuleGroups: RULE_GROUPS,
    planAssignments: {},
  })

  assert.equal(assignment, 'A-PRAK')
})

test('getCurrentPlannerAssignment keeps a valid manual choice and rejects an invalid one', () => {
  const course = createCourse({
    id: 'two-areas',
    masterCats: ['PRAK', 'THEO'],
    studyAreaOptions: [createStudyAreaOption('A-PRAK'), createStudyAreaOption('B-THEO')],
  })

  const manual = getCurrentPlannerAssignment(course, {
    studyProgramCode: STUDY_PROGRAM_CODE,
    regulationRuleGroups: RULE_GROUPS,
    planAssignments: { 'two-areas': 'B-THEO' },
  })
  assert.equal(manual, 'B-THEO')

  const invalidManual = getCurrentPlannerAssignment(course, {
    studyProgramCode: STUDY_PROGRAM_CODE,
    regulationRuleGroups: RULE_GROUPS,
    planAssignments: { 'two-areas': 'UNKNOWN' },
  })
  assert.equal(invalidManual, null)
})

test('getSuggestedPlannerAssignment prefers the area with the most remaining capacity', () => {
  const course = createCourse({
    id: 'two-areas',
    masterCats: ['PRAK', 'THEO'],
    studyAreaOptions: [createStudyAreaOption('A-PRAK'), createStudyAreaOption('B-THEO')],
  })

  const suggestion = getSuggestedPlannerAssignment(course, {
    studyProgramCode: STUDY_PROGRAM_CODE,
    regulationRuleGroups: RULE_GROUPS,
    planAssignments: {},
    plannedCourses: [],
    completedCourses: [],
  })

  assert.equal(suggestion, 'A-PRAK')
})

test('getSuggestedPlannerAssignment skips areas without remaining capacity', () => {
  const course = createCourse({
    id: 'two-areas',
    masterCats: ['PRAK', 'THEO'],
    studyAreaOptions: [createStudyAreaOption('A-PRAK'), createStudyAreaOption('B-THEO')],
  })
  const completed = createCompletedCourse({ id: 'done', ects: 9, studyAreaCode: 'A-PRAK' })

  const suggestion = getSuggestedPlannerAssignment(course, {
    studyProgramCode: STUDY_PROGRAM_CODE,
    regulationRuleGroups: RULE_GROUPS,
    planAssignments: {},
    plannedCourses: [],
    completedCourses: [completed],
  })

  assert.equal(suggestion, 'B-THEO')
})

test('resolveAutomaticPlannerAssignments balances fill ratios across areas', () => {
  const areaA = createAreaOption('A-PRAK')
  const areaB = createAreaOption('B-THEO')
  const candidates: PlannerAutomaticAssignmentCandidate[] = [
    { course: createCourse({ id: 'fixed' }), index: 0, options: [areaA] },
    { course: createCourse({ id: 'flexible' }), index: 1, options: [areaA, areaB] },
  ]
  const areas = [createAreaState('A-PRAK', 12), createAreaState('B-THEO', 12)]

  const assignments = resolveAutomaticPlannerAssignments({
    candidates,
    areas,
    regulationRuleGroups: RULE_GROUPS,
    studyProgramCode: STUDY_PROGRAM_CODE,
  })

  assert.equal(assignments.get('fixed')?.areaCode, 'A-PRAK')
  assert.equal(assignments.get('flexible')?.areaCode, 'B-THEO')
})

test('resolveAutomaticPlannerAssignments never exceeds area capacity', () => {
  const areaA = createAreaOption('A-PRAK')
  const candidates: PlannerAutomaticAssignmentCandidate[] = [
    { course: createCourse({ id: 'first' }), index: 0, options: [areaA] },
    { course: createCourse({ id: 'second' }), index: 1, options: [areaA] },
  ]
  const areas = [createAreaState('A-PRAK', 6)]

  const assignments = resolveAutomaticPlannerAssignments({
    candidates,
    areas,
    regulationRuleGroups: RULE_GROUPS,
    studyProgramCode: STUDY_PROGRAM_CODE,
  })

  assert.equal(assignments.size, 1)
  assert.equal(assignments.get('first')?.areaCode, 'A-PRAK')
  assert.equal(assignments.has('second'), false)
})

test('resolveAutomaticPlannerAssignments backtracks when a greedy choice would block a course', () => {
  const areaA = createAreaOption('A-PRAK')
  const areaB = createAreaOption('B-THEO')
  const areaC = createAreaOption('C-INFO')
  // "Alpha" is visited first and its sortOrder-preferred area is A-PRAK, but
  // taking it would leave "Beta" without any area (C-INFO has no capacity).
  const candidates: PlannerAutomaticAssignmentCandidate[] = [
    { course: createCourse({ id: 'Alpha', title: 'Alpha' }), index: 0, options: [areaA, areaB] },
    { course: createCourse({ id: 'Beta', title: 'Beta' }), index: 1, options: [areaA, areaC] },
  ]
  const areas = [
    createAreaState('A-PRAK', 6),
    createAreaState('B-THEO', 6),
    createAreaState('C-INFO', 0),
  ]

  const assignments = resolveAutomaticPlannerAssignments({
    candidates,
    areas,
    regulationRuleGroups: RULE_GROUPS,
    studyProgramCode: STUDY_PROGRAM_CODE,
  })

  assert.equal(assignments.size, 2)
  assert.equal(assignments.get('Alpha')?.areaCode, 'B-THEO')
  assert.equal(assignments.get('Beta')?.areaCode, 'A-PRAK')
})

test('resolveAutomaticPlannerAssignments accounts for already credited ECTS', () => {
  const areaA = createAreaOption('A-PRAK')
  const areaB = createAreaOption('B-THEO')
  const candidates: PlannerAutomaticAssignmentCandidate[] = [
    { course: createCourse({ id: 'course' }), index: 0, options: [areaA, areaB] },
  ]
  const areas = [createAreaState('A-PRAK', 12, 9), createAreaState('B-THEO', 12)]

  const assignments = resolveAutomaticPlannerAssignments({
    candidates,
    areas,
    regulationRuleGroups: RULE_GROUPS,
    studyProgramCode: STUDY_PROGRAM_CODE,
  })

  assert.equal(assignments.get('course')?.areaCode, 'B-THEO')
})

test('resolveAutomaticPlannerAssignments handles many flexible courses', () => {
  const areaCodes = ['A-PRAK', 'B-THEO', 'C-INFO']
  const options = areaCodes.map((code) => createAreaOption(code))
  const candidates: PlannerAutomaticAssignmentCandidate[] = Array.from({ length: 8 }, (_, index) => ({
    course: createCourse({ id: `course-${index}`, ects: 3 }),
    index,
    options,
  }))
  const areas = areaCodes.map((code) => createAreaState(code, 9))

  const assignments = resolveAutomaticPlannerAssignments({
    candidates,
    areas,
    regulationRuleGroups: RULE_GROUPS,
    studyProgramCode: STUDY_PROGRAM_CODE,
  })

  assert.equal(assignments.size, 8)
  const totals = new Map<string, number>()
  for (const assignment of assignments.values()) {
    totals.set(assignment.areaCode, (totals.get(assignment.areaCode) ?? 0) + assignment.ects)
  }
  for (const [areaCode, total] of totals) {
    assert.ok(total <= 9, `area ${areaCode} exceeds its capacity: ${total}`)
  }
})

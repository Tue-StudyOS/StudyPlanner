import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course, RecognitionEvidence } from '../../src/features/courses/types.ts'
import { buildPlannedCompletedCourse, buildRecognitionEvidence } from '../../src/features/transcript/utils/completedCoursePayload.ts'
import { withCreditPolicyModules } from '../../src/shared/utils/regulation.ts'

test('official policy module references reach the existing regulation area consumers', () => {
  const groups = [{ code: 'INF', name: 'Compulsory', groupType: 'pflicht' }]
  const modules = [{ code: 'INFM1020', name: 'Linear algebra', ects: 9, kind: 'module' }]
  const merged = withCreditPolicyModules(groups, { ruleGroups: [{ ...groups[0], modules }] })
  assert.deepEqual(merged[0].modules, modules)
  assert.equal('modules' in groups[0], false)
  assert.deepEqual(withCreditPolicyModules(groups, null)[0].modules, undefined)
})

test('both manual-entry modes preserve the explicit module, component and board allocation', () => {
  assert.deepEqual(buildRecognitionEvidence({
    confirmed: true, module: { code: 'INFM1020', areaCode: 'INF' }, areaCode: 'INFO',
    assessmentType: 'lecture', componentKind: 'component', componentKey: ' exam-1 ', countedEcts: '4,5',
  }), { confirmed: true, moduleCode: 'INFM1020', areaCode: 'INF', assessmentType: 'lecture',
    componentKind: 'component', componentKey: 'exam-1', countedEcts: 4.5 })
})

test('recognition is never inferred without an explicit confirmation', () => {
  assert.equal(buildRecognitionEvidence({
    confirmed: false, module: { code: 'INFM1020', areaCode: 'INF' }, areaCode: 'INF',
    assessmentType: 'lecture', componentKind: 'whole', componentKey: '', countedEcts: '',
  }), undefined)
})

test('semester completion retains source identity and explicit evidence without inventing counted totals', () => {
  const evidence: RecognitionEvidence = { confirmed: true, areaCode: 'INFO', assessmentType: 'lecture', countedEcts: 4 }
  const course: Course = {
    id: 'offering-2', number: 'INF1020-V', title: 'Linear algebra', lecturer: '', room: '', types: [],
    ects: 9, sws: null, masterCats: ['BASIS'], weekdays: [], schedule: [], frequency: '', language: '',
    prerequisites: [], description: '', exams: [], recognitionEvidence: evidence,
    isAdditionalAchievement: true, assessmentType: 'lecture',
    creditMetadata: { achievementKeysByProgram: { BSC_INFO_2021: 'module:INFM1020:whole' } },
  }
  const result = buildPlannedCompletedCourse(course, 'SS 2026', 'INFO', 'BSC_INFO_2021')
  assert.equal(result.achievementKey, 'module:INFM1020:whole')
  assert.equal(result.creditMetadata, course.creditMetadata)
  assert.deepEqual(result.recognitionEvidence, evidence)
  assert.equal(result.isAdditionalAchievement, true)
  assert.equal(result.ects, 9)
  assert.equal(result.degreeCountedEcts, undefined)
  assert.equal(result.gradeCountedEcts, undefined)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCreditAchievementKey, getProjectedDegreeEcts, projectPlannerCredits } from '../../src/shared/utils/creditProjection.ts'

test('uses server achievement identity before catalog metadata and never needs a catalog ID', () => {
  const course = {
    id: 'row-1', title: 'Lecture', ects: 6, grade: 1.66, masterCat: 'INFO' as const, semester: 'WS 2025/26',
    achievementKey: 'module:M_INF_12345:whole',
    creditMetadata: { achievementKeysByProgram: { MSC_INFO_2021: 'course:alias' } },
  }
  assert.equal(getCreditAchievementKey(course, 'MSC_INFO_2021'), 'module:M_INF_12345:whole')
  assert.equal(getCreditAchievementKey({ creditMetadata: { achievementKeysByProgram: { MSC_INFO_2021: 'module:M_INF_12345:whole' } } }, 'MSC_INFO_2021'), 'module:M_INF_12345:whole')
})

test('prefers official degree allocation and keeps additional achievements outside degree forecasts', () => {
  assert.equal(getProjectedDegreeEcts({ ects: 9, degreeCountedEcts: 4, isAdditionalAchievement: false }), 4)
  assert.equal(getProjectedDegreeEcts({ ects: 6, isAdditionalAchievement: true }), 0)
  assert.equal(getProjectedDegreeEcts({ ects: 3, isAdditionalAchievement: false }), 3)
})

test('projects module budgets and suppresses aliases sharing an assessment key', () => {
  const policy = {
    ruleGroups: [{ code: 'INF', name: 'Required', groupType: 'pflicht', requiredEcts: 114,
      modules: [{ code: 'INFM1020', name: 'Mathematics', kind: 'module', ects: 9 }] }],
  }
  const metadata = {
    achievementKeysByProgram: { BSC_INFO_2021: 'module:INFM1020:whole' },
    programs: [{ programCode: 'BSC_INFO_2021', allowedAreaCodes: ['INF'], modules: [
      { moduleCode: 'INFM1020', areaCode: 'INF', moduleKind: 'module', moduleBudgetEcts: 9 },
    ] }],
  }
  const result = projectPlannerCredits({
    programCode: 'BSC_INFO_2021', policy, completedCourses: [],
    assignedCourses: ['offering-1', 'offering-alias'].map((id) => ({
      course: { id, ects: 9, moduleCode: 'INFM1020', creditMetadata: metadata },
      areaCode: 'INF', eligibleAreaCodes: ['INF'],
    })),
  })
  assert.equal(result.plannedDegreeEcts, 9)
  assert.deepEqual(result.rows.filter((row) => row.isPlanned && row.degreeCountedEcts === 0).map((row) => row.reviewReasons), [['duplicate_achievement']])
})

test('enforces assessment-type area caps and BASIS declaration', () => {
  const ml = projectPlannerCredits({
    programCode: 'MSC_ML_2021',
    policy: { ruleGroups: [{ code: 'ML-DIVERSE', name: 'Diverse', groupType: 'elective_area', requiredEcts: 18 }],
      areaLimits: { 'ML-DIVERSE': { maxSeminarEcts: 6 } } },
    completedCourses: [],
    assignedCourses: [1, 2, 3].map((id) => ({
      course: { id: `seminar-${id}`, ects: 3, creditMetadata: {
        achievementKeysByProgram: { MSC_ML_2021: `assessment:SEM${id}` }, assessmentTypes: ['seminar'],
        programs: [{ programCode: 'MSC_ML_2021', allowedAreaCodes: ['ML-DIVERSE'] }],
      } }, areaCode: 'ML-DIVERSE', eligibleAreaCodes: ['ML-DIVERSE'],
    })),
  })
  assert.equal(ml.plannedDegreeEcts, 6)
  assert.equal(ml.rows.filter((row) => row.reviewReasons.includes('seminar_area_limit_exceeded')).length, 1)

  const basisPolicy = { conditionalAreaDeclaration: { preferenceKey: 'mscInfoBasisAdmissionConfirmed', trueArea: 'INFO-BASIS', falseArea: 'INFO-FOKUS' },
    ruleGroups: [{ code: 'INFO-BASIS', name: 'Basis', groupType: 'elective_area', requiredEcts: 18 },
      { code: 'INFO-FOKUS', name: 'Fokus', groupType: 'elective_area', requiredEcts: 18 }] }
  const course = { id: 'basis', ects: 9, creditMetadata: {
    achievementKeysByProgram: { MSC_INFO_2021: 'assessment:basis-math' },
    programs: [{ programCode: 'MSC_INFO_2021', allowedAreaCodes: ['INFO-BASIS', 'INFO-FOKUS'] }],
  } }
  const projection = (confirmed: boolean) => projectPlannerCredits({
    programCode: 'MSC_INFO_2021', policy: basisPolicy, completedCourses: [], mscInfoBasisAdmissionConfirmed: confirmed,
    assignedCourses: [{ course, areaCode: 'INFO-BASIS', eligibleAreaCodes: ['INFO-BASIS', 'INFO-FOKUS'] }],
  })
  assert.equal(projection(false).plannedDegreeEcts, 0)
  assert.equal(projection(true).plannedDegreeEcts, 9)
})

test('keeps generic thesis components uncredited and accepts exact written/oral split', () => {
  const policy = { writtenThesisEcts: 12, oralThesisEcts: 3,
    ruleGroups: [{ code: 'THESIS', name: 'Thesis', groupType: 'pflicht', requiredEcts: 15 }] }
  const planned = (kind: 'written' | 'oral' | 'component', ects: number, id: string) => ({
    course: { id, ects, recognitionEvidence: { confirmed: true as const, areaCode: 'THESIS', componentKind: kind,
      componentKey: id }, creditMetadata: { achievementKeysByProgram: { BSC_INFO_2021: `thesis:${id}` } } },
    areaCode: 'THESIS', eligibleAreaCodes: ['THESIS'],
  })
  const opaque = projectPlannerCredits({ programCode: 'BSC_INFO_2021', policy, completedCourses: [],
    assignedCourses: [planned('component', 15, 'opaque')] })
  assert.equal(opaque.plannedDegreeEcts, 0)
  const split = projectPlannerCredits({ programCode: 'BSC_INFO_2021', policy, completedCourses: [],
    assignedCourses: [planned('written', 12, 'written'), planned('oral', 3, 'oral')] })
  assert.equal(split.plannedDegreeEcts, 15)
})

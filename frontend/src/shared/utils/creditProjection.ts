import type { CompletedCourse, Course, CourseCreditMetadata } from '../../features/courses'
import type { CreditPolicy } from './regulation'

export interface ProjectedCourseCredit {
  id: string
  areaCode: string | null
  moduleCode: string | null
  recordedEcts: number
  uniqueEarnedEcts: number
  degreeCountedEcts: number
  gradeCountedEcts: number
  gradeUsedForAverage: number | null
  isPlanned: boolean
  reviewReasons: string[]
}

export interface AssignedPlannerCourse {
  course: ProjectionCourse
  areaCode: string | null
  eligibleAreaCodes: string[]
}

export interface CreditProjection {
  rows: ProjectedCourseCredit[]
  recordedEcts: number
  uniqueEarnedEcts: number
  degreeCountedEcts: number
  plannedDegreeEcts: number
  gradeCountedEcts: number
  areaCredits: Record<string, number>
  moduleProgress: Array<{
    code: string
    name: string
    areaCode: string
    requiredEcts: number
    earnedEcts: number
    plannedEcts: number
    isFulfilled: boolean
  }>
  missingRequiredModules: string[]
}

interface SourceModule {
  moduleCode: string
  areaCode: string
  moduleKind?: string | null
  moduleBudgetEcts?: number | null
  moduleEcts?: number | null
  parentBudgetEcts?: number | null
  componentEcts?: number | null
}

interface ProjectionCourse {
  id: string
  ects: number | null
  grade?: number | null
  studyAreaOptions?: Course['studyAreaOptions']
  creditMetadata?: CourseCreditMetadata | null
  moduleCode?: string | null
  achievementKey?: string | null
  canonicalModuleCode?: string | null
  recognitionEvidence?: CompletedCourse['recognitionEvidence']
  assessmentType?: string | null
  isAdditionalAchievement?: boolean
  courseNumber?: string | null
  externalCourseCode?: string | null
}

function metadataForProgram(metadata: CourseCreditMetadata | null | undefined, programCode: string): NonNullable<CourseCreditMetadata['programs']>[number] | null {
  return metadata?.programs?.find((program) => program.programCode === programCode) ?? null
}

export function getCreditAchievementKey(
  course: Pick<CompletedCourse, 'achievementKey' | 'creditMetadata'> | Pick<Course, 'creditMetadata'>,
  programCode: string | null | undefined,
): string | null {
  if ('achievementKey' in course && course.achievementKey) return course.achievementKey
  return programCode ? course.creditMetadata?.achievementKeysByProgram?.[programCode] ?? null : null
}

export function getProjectedDegreeEcts(
  course: Pick<CompletedCourse, 'degreeCountedEcts' | 'isAdditionalAchievement' | 'ects'>,
): number {
  if (typeof course.degreeCountedEcts === 'number') return course.degreeCountedEcts
  return course.isAdditionalAchievement ? 0 : course.ects
}

function moduleDefinitions(policy: CreditPolicy): Map<string, { areaCode: string; kind: string; ects: number | null }> {
  const result = new Map<string, { areaCode: string; kind: string; ects: number | null }>()
  for (const group of policy.ruleGroups ?? []) {
    for (const module of group.modules ?? []) {
      result.set(module.code, { areaCode: group.code, kind: module.kind, ects: module.ects })
    }
  }
  return result
}

function sourceModule(course: ProjectionCourse, programCode: string, areaCode: string): SourceModule | null {
  const program = metadataForProgram(course.creditMetadata, programCode)
  const candidates = (program?.modules ?? []).filter((module) =>
    module.areaCode === areaCode && module.moduleCode && module.moduleKind !== 'pool',
  )
  const unique = new Map(candidates.map((module) => [module.moduleCode, module]))
  return unique.size === 1 ? [...unique.values()][0] ?? null : null
}

function moduleCodeFor(course: ProjectionCourse, metadata: SourceModule | null): string | null {
  return metadata?.moduleCode ?? course.canonicalModuleCode ?? course.moduleCode ?? null
}

function moduleBudget(
  code: string | null,
  metadata: SourceModule | null,
  definitions: Map<string, { areaCode: string; kind: string; ects: number | null }>,
): number | null {
  if (!code) return null
  const definition = definitions.get(code)
  if (definition?.kind === 'pool') return null
  const amount = definition?.ects ?? metadata?.moduleBudgetEcts ?? metadata?.parentBudgetEcts
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : null
}

function reason(row: ProjectedCourseCredit, code: string): void {
  if (!row.reviewReasons.includes(code)) row.reviewReasons.push(code)
}

function courseTypes(course: ProjectionCourse): Set<string> {
  const types = course.creditMetadata?.assessmentTypes ?? []
  const explicit = course.assessmentType ?? course.recognitionEvidence?.assessmentType
  if (explicit && types.length === 0) return new Set([explicit])
  return new Set(types.map((type) => type.trim().toLowerCase()).filter(Boolean))
}

function conditionalArea(
  policy: CreditPolicy,
  basisAdmissionConfirmed: boolean,
): string | null {
  const declaration = policy.conditionalAreaDeclaration
  if (!declaration || declaration.preferenceKey !== 'mscInfoBasisAdmissionConfirmed') return null
  return basisAdmissionConfirmed ? declaration.trueArea : declaration.falseArea
}

function rowForCompleted(course: CompletedCourse): ProjectedCourseCredit {
  return {
    id: course.id,
    areaCode: course.studyAreaCode ?? null,
    moduleCode: course.canonicalModuleCode ?? null,
    recordedEcts: course.earnedEcts ?? course.ects,
    uniqueEarnedEcts: course.uniqueEarnedEcts ?? 0,
    degreeCountedEcts: course.degreeCountedEcts ?? 0,
    gradeCountedEcts: course.gradeCountedEcts ?? 0,
    gradeUsedForAverage: course.gradeUsedForAverage ?? null,
    isPlanned: false,
    reviewReasons: [...(course.creditReviewReasons ?? [])],
  }
}

/**
 * Projects only source-backed eligible offerings. Completed accounting is server authority;
 * forecasts use assessment identities, module budgets and caps carried by the active PO.
 */
export function projectPlannerCredits({
  programCode,
  policy,
  completedCourses,
  assignedCourses,
  mscInfoBasisAdmissionConfirmed = false,
}: {
  programCode: string
  policy: CreditPolicy
  completedCourses: CompletedCourse[]
  assignedCourses: AssignedPlannerCourse[]
  mscInfoBasisAdmissionConfirmed?: boolean
}): CreditProjection {
  const groups = new Map((policy.ruleGroups ?? []).map((group) => [group.code, group]))
  const definitions = moduleDefinitions(policy)
  const rows = completedCourses.map(rowForCompleted)
  const areaCredits: Record<string, number> = {}
  const moduleUsage = new Map<string, number>()
  const modulePlanned = new Map<string, number>()
  const areaTypeUsage = new Map<string, number>()
  const areaProjectCount = new Map<string, number>()
  const thesisComponentUsage = new Map<string, number>()
  let recordedEcts = 0
  let uniqueEarnedEcts = 0
  let degreeCountedEcts = 0
  let gradeCountedEcts = 0
  let seminarCount = 0

  rows.forEach((row, index) => {
    const course = completedCourses[index]
    recordedEcts += row.recordedEcts
    uniqueEarnedEcts += row.uniqueEarnedEcts
    degreeCountedEcts += row.degreeCountedEcts
    gradeCountedEcts += row.gradeCountedEcts
    if (row.areaCode && row.degreeCountedEcts > 0) {
      areaCredits[row.areaCode] = (areaCredits[row.areaCode] ?? 0) + row.degreeCountedEcts
      const metadata = sourceModule(course, programCode, row.areaCode)
      const code = moduleCodeFor(course, metadata)
      if (code) moduleUsage.set(code, (moduleUsage.get(code) ?? 0) + row.degreeCountedEcts)
      const types = courseTypes(course)
      if (types.has('seminar')) seminarCount += 1
      for (const kind of ['seminar', 'practical']) {
        if (types.has(kind)) {
          const key = `${row.areaCode}:${kind}`
          areaTypeUsage.set(key, (areaTypeUsage.get(key) ?? 0) + row.degreeCountedEcts)
        }
      }
      if (types.has('research_project')) areaProjectCount.set(row.areaCode, (areaProjectCount.get(row.areaCode) ?? 0) + 1)
    }
  })

  const completedKeys = new Set(completedCourses
    .map((course) => getCreditAchievementKey(course, programCode))
    .filter((key): key is string => Boolean(key)))
  const includedKeys = new Set(completedKeys)
  const planned = assignedCourses.map(({ course, areaCode, eligibleAreaCodes }) => {
    const row: ProjectedCourseCredit = {
      id: course.id,
      areaCode,
      moduleCode: null,
      recordedEcts: course.ects ?? 0,
      uniqueEarnedEcts: 0,
      degreeCountedEcts: 0,
      gradeCountedEcts: 0,
      gradeUsedForAverage: null,
      isPlanned: true,
      reviewReasons: [],
    }
    if (course.isAdditionalAchievement) return row
    if (!areaCode || !groups.has(areaCode)) {
      reason(row, 'area_not_in_regulation')
      return row
    }
    if (!eligibleAreaCodes.includes(areaCode)) {
      reason(row, 'course_eligibility_unverified')
      return row
    }
    const allowedConditionalArea = conditionalArea(policy, mscInfoBasisAdmissionConfirmed)
    const declaration = policy.conditionalAreaDeclaration
    const unavailableConditionalArea = declaration
      ? (allowedConditionalArea === declaration.trueArea ? declaration.falseArea : declaration.trueArea)
      : null
    if (areaCode === unavailableConditionalArea) {
      reason(row, 'conditional_area_not_selected')
      return row
    }
    const rawEcts = course.studyAreaOptions?.find((option) => option.programCode === programCode
      && option.studyAreaCode === areaCode && typeof option.ectsCounted === 'number')?.ectsCounted ?? course.ects
    if (typeof rawEcts !== 'number' || !Number.isFinite(rawEcts) || rawEcts <= 0) {
      reason(row, 'missing_or_invalid_credits')
      return row
    }
    row.recordedEcts = rawEcts
    const assessmentKey = getCreditAchievementKey(course, programCode)
      ?? (course.recognitionEvidence?.confirmed && (course.courseNumber || course.externalCourseCode)
        ? `recognized:${areaCode}:${course.recognitionEvidence.moduleCode ?? ''}:${course.recognitionEvidence.componentKey ?? course.courseNumber ?? course.externalCourseCode}`
        : null)
    if (!assessmentKey) {
      reason(row, 'assessment_identity_unverified')
      return row
    }
    if (includedKeys.has(assessmentKey)) {
      reason(row, 'duplicate_achievement')
      return row
    }
    const metadata = sourceModule(course, programCode, areaCode)
    const code = moduleCodeFor(course, metadata)
    row.moduleCode = code
    const module = code ? definitions.get(code) : undefined
    if (areaCode !== 'THESIS' && groups.get(areaCode)?.groupType.toLowerCase() === 'pflicht' && !module && !metadata) {
      reason(row, 'compulsory_module_unverified')
      return row
    }
    const moduleLimit = moduleBudget(code, metadata, definitions)
    const moduleTotal = code ? moduleUsage.get(code) ?? 0 : 0
    const sourceType = courseTypes(course)
    const evidence = course.recognitionEvidence
    const countedEcts = evidence?.confirmed && typeof evidence.countedEcts === 'number'
      ? evidence.countedEcts
      : rawEcts
    if (countedEcts < rawEcts && areaCode === 'THESIS') {
      reason(row, 'thesis_credit_cannot_be_partial')
      return row
    }
    if (areaCode === 'THESIS') {
      const target = groups.get(areaCode)?.requiredEcts ?? 0
      const kind = evidence?.componentKind ?? (rawEcts === target ? 'whole' : null)
      if (!kind || kind === 'component') {
        reason(row, 'completion_component_kind_unverified')
        return row
      }
      if (kind === 'whole' && rawEcts !== target) {
        reason(row, 'completion_whole_credit_mismatch')
        return row
      }
      const componentLimit = kind === 'written' ? policy.writtenThesisEcts
        : kind === 'oral' ? policy.oralThesisEcts : null
      if (componentLimit && (thesisComponentUsage.get(kind) ?? 0) + countedEcts > componentLimit) {
        reason(row, 'completion_component_credit_limit_exceeded')
        return row
      }
      if (componentLimit) thesisComponentUsage.set(kind, (thesisComponentUsage.get(kind) ?? 0) + countedEcts)
    }
    if (moduleLimit !== null && moduleTotal + countedEcts > moduleLimit) {
      reason(row, module?.kind === 'choice' ? 'alternative_slot_credits_capped' : 'module_credit_limit_exceeded')
      return row
    }
    const group = groups.get(areaCode)
    const areaLimit = group?.maxEcts ?? group?.requiredEcts ?? null
    if (areaLimit !== null && (areaCredits[areaCode] ?? 0) + countedEcts > areaLimit) {
      reason(row, 'area_credit_limit_exceeded')
      return row
    }
    const limits = policy.areaLimits?.[areaCode] ?? {}
    if (sourceType.has('seminar') && policy.maxSeminars != null && seminarCount >= policy.maxSeminars) {
      reason(row, 'seminar_count_limit_exceeded')
      return row
    }
    let exceedsTypeLimit = false
    for (const [kind, limitKey] of [['seminar', 'maxSeminarEcts'], ['practical', 'maxPracticalEcts']] as const) {
      const limit = limits[limitKey]
      const used = areaTypeUsage.get(`${areaCode}:${kind}`) ?? 0
      if (sourceType.has(kind) && typeof limit === 'number' && used + countedEcts > limit) {
        reason(row, `${kind}_area_limit_exceeded`)
        exceedsTypeLimit = true
      }
    }
    if (sourceType.has('research_project') && typeof limits.maxResearchProjects === 'number'
      && (areaProjectCount.get(areaCode) ?? 0) >= limits.maxResearchProjects) {
      reason(row, 'area_research_projects_exceeded')
      return row
    }
    if (exceedsTypeLimit) return row
    row.uniqueEarnedEcts = 0
    row.degreeCountedEcts = countedEcts
    row.gradeCountedEcts = policy.gradeExcludedAreas?.includes(areaCode) ? 0 : countedEcts
    row.gradeUsedForAverage = row.gradeCountedEcts > 0 ? course.grade ?? null : null
    includedKeys.add(assessmentKey)
    areaCredits[areaCode] = (areaCredits[areaCode] ?? 0) + countedEcts
    if (code) {
      moduleUsage.set(code, moduleTotal + countedEcts)
      modulePlanned.set(code, (modulePlanned.get(code) ?? 0) + countedEcts)
    }
    if (sourceType.has('seminar')) seminarCount += 1
    for (const kind of ['seminar', 'practical']) {
      if (sourceType.has(kind)) {
        const key = `${areaCode}:${kind}`
        areaTypeUsage.set(key, (areaTypeUsage.get(key) ?? 0) + countedEcts)
      }
    }
    if (sourceType.has('research_project')) areaProjectCount.set(areaCode, (areaProjectCount.get(areaCode) ?? 0) + 1)
    return row
  })

  const totalRows = [...rows, ...planned]
  const moduleProgress = (policy.ruleGroups ?? []).flatMap((group) =>
    (group.modules ?? [])
      .filter((module) => module.kind !== 'pool' && module.ects !== null)
      .map((module) => {
        const earned = rows.filter((row) => row.moduleCode === module.code)
          .reduce((sum, row) => sum + row.degreeCountedEcts, 0)
        const forecast = modulePlanned.get(module.code) ?? 0
        return {
          code: module.code,
          name: module.name,
          areaCode: group.code,
          requiredEcts: module.ects as number,
          earnedEcts: earned,
          plannedEcts: forecast,
          isFulfilled: earned + forecast >= (module.ects as number),
        }
      }),
  )
  return {
    rows: totalRows,
    recordedEcts,
    uniqueEarnedEcts,
    degreeCountedEcts,
    plannedDegreeEcts: planned.reduce((sum, row) => sum + row.degreeCountedEcts, 0),
    gradeCountedEcts,
    areaCredits,
    moduleProgress,
    missingRequiredModules: moduleProgress.filter((module) => !module.isFulfilled).map((module) => module.code),
  }
}

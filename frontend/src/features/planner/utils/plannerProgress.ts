import type { CreditPolicy, RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { getCreditAchievementKey, getProjectedDegreeEcts, projectPlannerCredits } from '../../../shared/utils/creditProjection.ts'
import {
  getEffectiveRuleGroupCapacity,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'
import {
  getPlannerCourseAreaOptions,
  getPlannerCourseEctsForArea,
  INFO_BASIS_AREA_CODE,
  INFO_FOKUS_AREA_CODE,
  resolveAutomaticPlannerAssignments,
  resolveChosenInfoAlternativeAreaCode,
  type PlannerAutomaticAssignmentCandidate,
} from './plannerAssignments'

// One of INFO-FOKUS / INFO-BASIS is chosen for the degree; the other is shown but
// marked deselected so the planner bar can explain the alternative.
export type InfoAlternativeState = 'selected' | 'deselected'

export interface PlannerProgressArea {
  code: string
  name: string
  requiredEcts: number | null
  capacityEcts: number | null
  creditedEcts: number
  plannedEcts: number
  masterCat: MasterCat | null
  plannedCourses: PlannerProgressCourse[]
  creditedCourses: PlannerCreditedCourse[]
  infoAlternativeState?: InfoAlternativeState
  moduleProgress?: Array<{ code: string; name: string; requiredEcts: number; earnedEcts: number; plannedEcts: number; isFulfilled: boolean }>
}

interface PlannerCreditedCourse {
  id: string
  title: string
  ects: number
  grade: number | null
  semester: string
}

interface PlannerProgressCourse {
  id: string
  title: string
  ects: number
  assignedAreaCode: string
  options: RegulationAreaOption[]
  creditReviewReasons?: string[]
}

interface UnassignedPlannerCourse {
  id: string
  title: string
  ects: number
  options: RegulationAreaOption[]
  reason?: string
}

export function roundEcts(value: number): number {
  return Math.round(value * 10) / 10
}

function isVisiblePlannerRuleGroup(ruleGroup: RegulationRuleGroup): boolean {
  return ruleGroup.code.trim().toUpperCase() !== 'THESIS'
}

// Flags the two INFO alternatives so the planner bar can mark the chosen one and
// dim the other. Areas outside the FOKUS/BASIS pair stay unannotated.
function getInfoAlternativeState(
  code: string,
  chosenInfoAlternativeCode: string | null,
): InfoAlternativeState | undefined {
  if (!chosenInfoAlternativeCode) {
    return undefined
  }
  const normalizedCode = code.trim().toUpperCase()
  if (normalizedCode !== INFO_FOKUS_AREA_CODE && normalizedCode !== INFO_BASIS_AREA_CODE) {
    return undefined
  }
  return normalizedCode === chosenInfoAlternativeCode.toUpperCase() ? 'selected' : 'deselected'
}

function getRuleGroupRequiredEcts(ruleGroup: RegulationRuleGroup): number | null {
  return ruleGroup.requiredEcts ?? ruleGroup.minEcts ?? ruleGroup.maxEcts ?? null
}

function buildFallbackArea(option: RegulationAreaOption): PlannerProgressArea {
  return {
    code: option.code,
    name: option.label,
    requiredEcts: null,
    capacityEcts: null,
    creditedEcts: 0,
    plannedEcts: 0,
    masterCat: option.masterCat,
    plannedCourses: [],
    creditedCourses: [],
  }
}

export function buildPlannerProgressAreas({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
  creditPolicy,
  mscInfoBasisAdmissionConfirmed = false,
}: {
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
  creditPolicy?: CreditPolicy | null
  mscInfoBasisAdmissionConfirmed?: boolean
}): {
  areas: PlannerProgressArea[]
  unassignedCourses: UnassignedPlannerCourse[]
  chosenInfoAlternativeCode: string | null
} {
  const chosenInfoAlternativeCode = resolveChosenInfoAlternativeAreaCode({
    plannedCourses,
    completedCourses,
    studyProgramCode,
    regulationRuleGroups,
    mscInfoBasisAdmissionConfirmed,
  })
  const areas: PlannerProgressArea[] = regulationRuleGroups
    .filter(isVisiblePlannerRuleGroup)
    .map((ruleGroup) => ({
      code: ruleGroup.code,
      name: ruleGroup.name,
      requiredEcts: getRuleGroupRequiredEcts(ruleGroup),
      capacityEcts: getEffectiveRuleGroupCapacity(ruleGroup),
      creditedEcts: 0,
      plannedEcts: 0,
      masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
      plannedCourses: [],
      creditedCourses: [],
      infoAlternativeState: getInfoAlternativeState(ruleGroup.code, chosenInfoAlternativeCode),
    }))
  const areaByCode = new Map(areas.map((area) => [area.code, area]))
  const unassignedCourses: UnassignedPlannerCourse[] = []
  const automaticCandidates: PlannerAutomaticAssignmentCandidate[] = []

  if (areas.length === 0) {
    plannedCourses.forEach((course) => {
      getPlannerCourseAreaOptions(
        course,
        studyProgramCode,
        regulationRuleGroups,
        chosenInfoAlternativeCode,
      ).forEach((option) => {
        if (!areaByCode.has(option.code)) {
          const area = buildFallbackArea(option)
          areas.push(area)
          areaByCode.set(area.code, area)
        }
      })
    })
  }

  completedCourses.forEach((course) => {
    if (!course.studyAreaCode) {
      return
    }
    let area = areaByCode.get(course.studyAreaCode)
    if (!area && regulationRuleGroups.length === 0) {
      area = {
        code: course.studyAreaCode,
        name: course.studyAreaName ?? course.studyAreaCode,
        requiredEcts: null,
        capacityEcts: null,
        creditedEcts: 0,
        plannedEcts: 0,
        masterCat: course.masterCat,
        plannedCourses: [],
        creditedCourses: [],
      }
      areas.push(area)
      areaByCode.set(area.code, area)
    }
    if (!area) {
      return
    }
    const countedEcts = getProjectedDegreeEcts(course)
    area.creditedEcts += countedEcts
    area.creditedCourses.push({
      id: course.id,
      title: cleanCourseTitle(course.title, course.courseNumber),
      ects: countedEcts,
      grade: course.gradeUsedForAverage ?? course.grade,
      semester: course.semester,
    })
  })

  const completedAchievementKeys = new Set(completedCourses
    .map((course) => getCreditAchievementKey(course, studyProgramCode))
    .filter((key): key is string => Boolean(key)))
  const plannedAchievementKeys = new Set<string>()
  const completedCourseIds = new Set(
    completedCourses
      .map((course) => course.courseId)
      .filter((courseId): courseId is string => Boolean(courseId)),
  )

  plannedCourses.forEach((course, index) => {
    const achievementKey = getCreditAchievementKey(course, studyProgramCode)
    if (completedCourseIds.has(course.id) || (achievementKey && completedAchievementKeys.has(achievementKey))) {
      return
    }
    if (achievementKey && plannedAchievementKeys.has(achievementKey)) {
      unassignedCourses.push({
        id: course.id,
        title: cleanCourseTitle(course.title, course.number),
        ects: course.ects ?? 0,
        options: [],
        reason: 'This assessment is already represented by another completed or planned offering.',
      })
      return
    }
    if (achievementKey) plannedAchievementKeys.add(achievementKey)

    const options = getPlannerCourseAreaOptions(
      course,
      studyProgramCode,
      regulationRuleGroups,
      chosenInfoAlternativeCode,
    )
    const preferredAreaCode = planAssignments[course.id]
    const manualOption = preferredAreaCode
      ? options.find((option) => option.code === preferredAreaCode)
      : undefined

    if (manualOption) {
      const area = areaByCode.get(manualOption.code)
      if (!area) {
        const courseEcts = getPlannerCourseEctsForArea(course, manualOption.code, studyProgramCode)
        unassignedCourses.push({
          id: course.id,
          title: cleanCourseTitle(course.title, course.number),
          ects: courseEcts,
          options,
        })
        return
      }
      const courseEcts = getPlannerCourseEctsForArea(course, manualOption.code, studyProgramCode)
      area.plannedEcts += courseEcts
      area.plannedCourses.push({
        id: course.id,
        title: cleanCourseTitle(course.title, course.number),
        ects: courseEcts,
        assignedAreaCode: manualOption.code,
        options,
      })
      return
    }

    if (options.length === 0) {
      unassignedCourses.push({
        id: course.id,
        title: cleanCourseTitle(course.title, course.number),
        ects: course.ects ?? 0,
        options,
      })
      return
    }

    automaticCandidates.push({
      course,
      index,
      options,
    })
  })

  if (creditPolicy && studyProgramCode) {
    const assigned = areas.flatMap((area) => area.plannedCourses.map((plannedCourse) => {
      const course = plannedCourses.find((candidate) => candidate.id === plannedCourse.id)
      return course ? {
        course,
        areaCode: plannedCourse.assignedAreaCode,
        eligibleAreaCodes: plannedCourse.options.map((option) => option.code),
      } : null
    })).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    const projection = projectPlannerCredits({
      programCode: studyProgramCode,
      policy: creditPolicy,
      completedCourses,
      assignedCourses: assigned,
      mscInfoBasisAdmissionConfirmed,
    })
    const projectedById = new Map(projection.rows.filter((row) => row.isPlanned).map((row) => [row.id, row]))
    areas.forEach((area) => {
      area.plannedEcts = 0
      area.plannedCourses = area.plannedCourses.map((course) => {
        const projected = projectedById.get(course.id)
        area.plannedEcts += projected?.degreeCountedEcts ?? 0
        return { ...course, ects: projected?.degreeCountedEcts ?? 0, creditReviewReasons: projected?.reviewReasons ?? [] }
      })
    })
  }

  const automaticAssignments = resolveAutomaticPlannerAssignments({
    candidates: automaticCandidates,
    areas,
    regulationRuleGroups,
    studyProgramCode,
    isCreditAssignmentValid: creditPolicy && studyProgramCode ? (assignments, candidateId) => {
      const assigned = areas.flatMap((area) => area.plannedCourses.map((plannedCourse) => {
        const course = plannedCourses.find((candidate) => candidate.id === plannedCourse.id)
        return course ? { course, areaCode: plannedCourse.assignedAreaCode, eligibleAreaCodes: plannedCourse.options.map((option) => option.code) } : null
      })).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      assignments.forEach((assignment, id) => {
        const course = plannedCourses.find((candidate) => candidate.id === id)
        const options = automaticCandidates.find((candidate) => candidate.course.id === id)?.options ?? []
        if (course) assigned.push({
          course,
          areaCode: assignment.areaCode,
          eligibleAreaCodes: options.map((option) => option.code),
        })
      })
      const projected = projectPlannerCredits({
        programCode: studyProgramCode,
        policy: creditPolicy,
        completedCourses,
        assignedCourses: assigned,
        mscInfoBasisAdmissionConfirmed,
      }).rows.find((row) => row.id === candidateId)
      return Boolean(projected && projected.degreeCountedEcts > 0 && projected.reviewReasons.length === 0)
    } : undefined,
  })

  automaticCandidates.forEach(({ course, options }) => {
    const automaticAssignment = automaticAssignments.get(course.id)
    if (!automaticAssignment) {
      unassignedCourses.push({
        id: course.id,
        title: cleanCourseTitle(course.title, course.number),
        ects: course.ects ?? 0,
        options,
      })
      return
    }

    const area = areaByCode.get(automaticAssignment.areaCode)
    if (!area) {
      unassignedCourses.push({
        id: course.id,
        title: cleanCourseTitle(course.title, course.number),
        ects: automaticAssignment.ects,
        options,
      })
      return
    }
    area.plannedEcts += automaticAssignment.ects
    area.plannedCourses.push({
      id: course.id,
      title: cleanCourseTitle(course.title, course.number),
      ects: automaticAssignment.ects,
      assignedAreaCode: automaticAssignment.areaCode,
      options,
    })
  })

  if (creditPolicy && studyProgramCode) {
    const assigned = areas.flatMap((area) => area.plannedCourses.map((plannedCourse) => {
      const course = plannedCourses.find((candidate) => candidate.id === plannedCourse.id)
      return course ? {
        course,
        areaCode: plannedCourse.assignedAreaCode,
        eligibleAreaCodes: plannedCourse.options.map((option) => option.code),
      } : null
    })).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    const projection = projectPlannerCredits({
      programCode: studyProgramCode,
      policy: creditPolicy,
      completedCourses,
      assignedCourses: assigned,
      mscInfoBasisAdmissionConfirmed,
    })
    const projectedById = new Map(projection.rows.filter((row) => row.isPlanned).map((row) => [row.id, row]))
    areas.forEach((area) => {
      area.plannedEcts = 0
      area.moduleProgress = projection.moduleProgress.filter((module) => module.areaCode === area.code)
      area.plannedCourses = area.plannedCourses.map((course) => {
        const projected = projectedById.get(course.id)
        const countedEcts = projected?.degreeCountedEcts ?? 0
        area.plannedEcts += countedEcts
        return { ...course, ects: countedEcts, creditReviewReasons: projected?.reviewReasons ?? [] }
      })
    })
  }

  return {
    areas,
    unassignedCourses,
    chosenInfoAlternativeCode,
  }
}

import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildMappedCourseAreaOptions,
  getEffectiveRuleGroupCapacity,
} from '../../../shared/utils/regulation'

interface PlannerAssignmentContext {
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
}

function getCapacityEctsByArea(ruleGroups: RegulationRuleGroup[]): Map<string, number | null> {
  return new Map(
    ruleGroups.map((ruleGroup) => [ruleGroup.code, getEffectiveRuleGroupCapacity(ruleGroup)]),
  )
}

function buildCreditedEctsByArea(
  completedCourses: CompletedCourse[],
  plannedCourses: Course[],
  planAssignments: Record<string, string>,
  studyProgramCode: string | null,
  regulationRuleGroups: RegulationRuleGroup[],
  excludeCourseId?: string,
): Map<string, number> {
  const creditedEctsByArea = new Map<string, number>()

  completedCourses.forEach((course) => {
    if (!course.studyAreaCode) {
      return
    }
    creditedEctsByArea.set(
      course.studyAreaCode,
      (creditedEctsByArea.get(course.studyAreaCode) ?? 0) + course.ects,
    )
  })

  plannedCourses.forEach((course) => {
    if (course.id === excludeCourseId) {
      return
    }
    const resolvedAssignment = getCurrentPlannerAssignment(course, {
      studyProgramCode,
      regulationRuleGroups,
      planAssignments,
    })
    if (!resolvedAssignment) {
      return
    }
    creditedEctsByArea.set(
      resolvedAssignment,
      (creditedEctsByArea.get(resolvedAssignment) ?? 0) + (course.ects ?? 0),
    )
  })

  return creditedEctsByArea
}

export function getPlannerCourseAreaOptions(
  course: Course,
  studyProgramCode: string | null,
  regulationRuleGroups: RegulationRuleGroup[],
): RegulationAreaOption[] {
  void regulationRuleGroups
  const hasAnyCategory = (course.studyAreaOptions?.length ?? 0) > 0 || course.masterCats.length > 0
  if (!hasAnyCategory) {
    return []
  }
  return buildMappedCourseAreaOptions(
    course.studyAreaOptions,
    studyProgramCode,
  )
}

export function getCurrentPlannerAssignment(
  course: Course,
  params: {
    studyProgramCode: string | null
    regulationRuleGroups: RegulationRuleGroup[]
    planAssignments: Record<string, string>
  },
): string | null {
  const options = getPlannerCourseAreaOptions(
    course,
    params.studyProgramCode,
    params.regulationRuleGroups,
  )
  const manualAssignment = params.planAssignments[course.id]
  if (manualAssignment && options.some((option) => option.code === manualAssignment)) {
    return manualAssignment
  }
  if (options.length === 1) {
    return options[0].code
  }
  return null
}

export function getSuggestedPlannerAssignment(
  course: Course,
  context: PlannerAssignmentContext,
): string | null {
  const options = getPlannerCourseAreaOptions(
    course,
    context.studyProgramCode,
    context.regulationRuleGroups,
  )
  if (options.length === 0) {
    return null
  }

  const manualAssignment = context.planAssignments[course.id]
  if (manualAssignment && options.some((option) => option.code === manualAssignment)) {
    return manualAssignment
  }

  const capacityEctsByArea = getCapacityEctsByArea(context.regulationRuleGroups)
  const creditedEctsByArea = buildCreditedEctsByArea(
    context.completedCourses,
    context.plannedCourses,
    context.planAssignments,
    context.studyProgramCode,
    context.regulationRuleGroups,
    course.id,
  )

  const courseEcts = course.ects ?? 0
  const optionsWithCapacity = options.filter((option) => {
    const capacityEcts = capacityEctsByArea.get(option.code)
    if (capacityEcts === undefined || capacityEcts === null) {
      return true
    }
    const creditedEcts = creditedEctsByArea.get(option.code) ?? 0
    return creditedEcts + courseEcts <= capacityEcts
  })

  if (optionsWithCapacity.length === 0) {
    return null
  }

  return [...optionsWithCapacity]
    .sort((left, right) => {
      const leftCapacityEcts = capacityEctsByArea.get(left.code)
      const rightCapacityEcts = capacityEctsByArea.get(right.code)
      const leftCreditedEcts = creditedEctsByArea.get(left.code) ?? 0
      const rightCreditedEcts = creditedEctsByArea.get(right.code) ?? 0
      const leftRemainingEcts = leftCapacityEcts === null || leftCapacityEcts === undefined
        ? Number.POSITIVE_INFINITY
        : leftCapacityEcts - leftCreditedEcts
      const rightRemainingEcts = rightCapacityEcts === null || rightCapacityEcts === undefined
        ? Number.POSITIVE_INFINITY
        : rightCapacityEcts - rightCreditedEcts

      if (rightRemainingEcts !== leftRemainingEcts) {
        return rightRemainingEcts - leftRemainingEcts
      }
      if (leftCreditedEcts !== rightCreditedEcts) {
        return leftCreditedEcts - rightCreditedEcts
      }
      return left.label.localeCompare(right.label)
    })
    .at(0)?.code ?? null
}

export function getResolvedPlannerAssignment(
  course: Course,
  context: PlannerAssignmentContext,
): string | null {
  return getCurrentPlannerAssignment(course, {
    studyProgramCode: context.studyProgramCode,
    regulationRuleGroups: context.regulationRuleGroups,
    planAssignments: context.planAssignments,
  }) ?? getSuggestedPlannerAssignment(course, context)
}

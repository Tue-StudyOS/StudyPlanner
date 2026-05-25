import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { buildAssignableRegulationAreaOptions } from '../../../shared/utils/regulation'

interface PlannerAssignmentContext {
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
}

function getRequiredEctsByArea(ruleGroups: RegulationRuleGroup[]): Map<string, number> {
  return new Map(
    ruleGroups.map((ruleGroup) => [ruleGroup.code, ruleGroup.requiredEcts ?? 0]),
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
  return buildAssignableRegulationAreaOptions(
    course.studyAreaOptions,
    studyProgramCode,
    regulationRuleGroups,
    course.masterCats,
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

  const currentAssignment = getCurrentPlannerAssignment(course, {
    studyProgramCode: context.studyProgramCode,
    regulationRuleGroups: context.regulationRuleGroups,
    planAssignments: context.planAssignments,
  })
  if (currentAssignment) {
    return currentAssignment
  }

  const requiredEctsByArea = getRequiredEctsByArea(context.regulationRuleGroups)
  const creditedEctsByArea = buildCreditedEctsByArea(
    context.completedCourses,
    context.plannedCourses,
    context.planAssignments,
    context.studyProgramCode,
    context.regulationRuleGroups,
    course.id,
  )

  return [...options]
    .sort((left, right) => {
      const leftRequiredEcts = requiredEctsByArea.get(left.code) ?? 0
      const rightRequiredEcts = requiredEctsByArea.get(right.code) ?? 0
      const leftCreditedEcts = creditedEctsByArea.get(left.code) ?? 0
      const rightCreditedEcts = creditedEctsByArea.get(right.code) ?? 0
      const leftRemainingEcts = leftRequiredEcts - leftCreditedEcts
      const rightRemainingEcts = rightRequiredEcts - rightCreditedEcts

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

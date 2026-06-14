import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildAssignableRegulationAreaOptions,
  getEffectiveRuleGroupCapacity,
} from '../../../shared/utils/regulation.ts'

interface PlannerAssignmentContext {
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
}

export interface PlannerAutomaticAssignmentCandidate {
  course: Course
  index: number
  options: RegulationAreaOption[]
}

export interface PlannerAssignmentAreaState {
  code: string
  capacityEcts: number | null
  creditedEcts: number
  plannedEcts: number
}

interface PlannerAutomaticAssignment {
  areaCode: string
  ects: number
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
  const hasAnyCategory = (course.studyAreaOptions?.length ?? 0) > 0 || course.masterCats.length > 0
  if (!hasAnyCategory) {
    return []
  }
  return buildAssignableRegulationAreaOptions(
    course.studyAreaOptions,
    studyProgramCode,
    regulationRuleGroups,
    course.masterCats,
  )
}

export function getPlannerCourseEctsForArea(
  course: Course,
  areaCode: string,
  studyProgramCode: string | null,
): number {
  const matchingOptions = course.studyAreaOptions?.filter((option) =>
    option.studyAreaCode === areaCode
    && (!studyProgramCode || option.programCode === studyProgramCode),
  ) ?? []
  const matchingOption = matchingOptions.find((option) => typeof option.ectsCounted === 'number')
  return matchingOption?.ectsCounted ?? course.ects ?? 0
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

function buildAreaSortOrder(regulationRuleGroups: RegulationRuleGroup[]): Map<string, number> {
  return new Map(
    regulationRuleGroups.map((ruleGroup) => [ruleGroup.code, ruleGroup.sortOrder ?? 0]),
  )
}

function scoreAutomaticAssignmentSolution(
  assignments: Map<string, PlannerAutomaticAssignment>,
  totalsByArea: Map<string, number>,
  areas: PlannerAssignmentAreaState[],
  areaSortOrder: Map<string, number>,
): number[] {
  let remainingCapacity = 0
  const fillRatios: number[] = []

  areas.forEach((area) => {
    const capacityEcts = area.capacityEcts
    if (capacityEcts === null) {
      return
    }
    const areaTotal = totalsByArea.get(area.code) ?? 0
    remainingCapacity += Math.max(0, capacityEcts - areaTotal)
    if (capacityEcts > 0) {
      fillRatios.push(Math.max(0, areaTotal / capacityEcts))
    }
  })

  const maxFillRatio = fillRatios.length > 0 ? Math.max(...fillRatios) : 0
  const meanFillRatio = fillRatios.length > 0
    ? fillRatios.reduce((sum, ratio) => sum + ratio, 0) / fillRatios.length
    : 0
  const fillVariance = fillRatios.reduce(
    (sum, ratio) => sum + ((ratio - meanFillRatio) ** 2),
    0,
  )
  const filledAreaCount = fillRatios.filter((ratio) => ratio > 0.0001).length
  const sortPenalty = [...assignments.values()].reduce(
    (sum, assignment) => sum + (areaSortOrder.get(assignment.areaCode) ?? 0),
    0,
  )

  return [
    assignments.size,
    -remainingCapacity,
    -maxFillRatio,
    -fillVariance,
    filledAreaCount,
    -sortPenalty,
  ]
}

function isScoreBetter(candidate: number[], current: number[] | null): boolean {
  if (current === null) {
    return true
  }

  for (let index = 0; index < candidate.length; index += 1) {
    const candidateValue = candidate[index] ?? 0
    const currentValue = current[index] ?? 0
    if (candidateValue !== currentValue) {
      return candidateValue > currentValue
    }
  }
  return false
}

export function resolveAutomaticPlannerAssignments({
  candidates,
  areas,
  regulationRuleGroups,
  studyProgramCode,
}: {
  candidates: PlannerAutomaticAssignmentCandidate[]
  areas: PlannerAssignmentAreaState[]
  regulationRuleGroups: RegulationRuleGroup[]
  studyProgramCode: string | null
}): Map<string, PlannerAutomaticAssignment> {
  const areaByCode = new Map(areas.map((area) => [area.code, area]))
  const areaSortOrder = buildAreaSortOrder(regulationRuleGroups)
  const orderedCandidates = [...candidates].sort((left, right) => {
    const leftOptionCount = left.options.length || Number.POSITIVE_INFINITY
    const rightOptionCount = right.options.length || Number.POSITIVE_INFINITY
    return (
      leftOptionCount - rightOptionCount
      || left.course.title.localeCompare(right.course.title)
      || left.index - right.index
    )
  })
  // Resolve sorting, area lookup, and per-area ECTS once per candidate so the
  // exponential search below only does cheap number comparisons per node.
  const preparedCandidates = orderedCandidates.map((candidate) => ({
    courseId: candidate.course.id,
    options: [...candidate.options]
      .sort((left, right) => {
        const sortOrderDifference =
          (areaSortOrder.get(left.code) ?? 0) - (areaSortOrder.get(right.code) ?? 0)
        return sortOrderDifference || left.label.localeCompare(right.label)
      })
      .filter((option) => areaByCode.has(option.code))
      .map((option) => ({
        areaCode: option.code,
        capacityEcts: areaByCode.get(option.code)?.capacityEcts ?? null,
        ects: getPlannerCourseEctsForArea(candidate.course, option.code, studyProgramCode),
      })),
  }))
  const currentTotals = new Map(
    areas.map((area) => [area.code, area.creditedEcts + area.plannedEcts]),
  )
  const currentAssignments = new Map<string, PlannerAutomaticAssignment>()
  let bestAssignments = new Map<string, PlannerAutomaticAssignment>()
  let bestScore: number[] | null = null
  let bestAssignmentCount = -1

  function visit(index: number): void {
    // The assignment count dominates the lexicographic score, so any branch
    // that cannot reach the best count anymore can never win. Equal counts
    // are still explored to keep the tie-breaking results identical.
    if (currentAssignments.size + (preparedCandidates.length - index) < bestAssignmentCount) {
      return
    }

    if (index >= preparedCandidates.length) {
      const score = scoreAutomaticAssignmentSolution(
        currentAssignments,
        currentTotals,
        areas,
        areaSortOrder,
      )
      if (isScoreBetter(score, bestScore)) {
        bestScore = score
        bestAssignmentCount = currentAssignments.size
        bestAssignments = new Map(currentAssignments)
      }
      return
    }

    const candidate = preparedCandidates[index]
    for (const option of candidate.options) {
      const currentAreaTotal = currentTotals.get(option.areaCode) ?? 0
      if (option.capacityEcts !== null && currentAreaTotal + option.ects > option.capacityEcts + 0.0001) {
        continue
      }

      currentAssignments.set(candidate.courseId, {
        areaCode: option.areaCode,
        ects: option.ects,
      })
      currentTotals.set(option.areaCode, currentAreaTotal + option.ects)
      visit(index + 1)
      currentTotals.set(option.areaCode, currentAreaTotal)
      currentAssignments.delete(candidate.courseId)
    }

    visit(index + 1)
  }

  visit(0)
  return bestAssignments
}

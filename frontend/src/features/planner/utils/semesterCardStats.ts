import type { CompletedCourse, Course } from '../../courses'
import type { SemesterPlan, SemesterPlanSummary } from '../types.ts'
import { formatRegulationAreaShortLabel } from '../../../shared/utils/regulation.ts'

export interface SemesterAreaStat {
  areaCode: string
  label: string
  ects: number
}

export interface SemesterCardStats {
  totalEcts: number
  courseCount: number
  areaStats: SemesterAreaStat[]
}

export type SemesterCardPlanDetails = Pick<SemesterPlan, 'courseIds' | 'courseAssignments'>

function roundEcts(value: number): number {
  return Math.round(value * 10) / 10
}

function addAreaEcts(areaEcts: Map<string, number>, areaCode: string | null | undefined, ects: number): void {
  if (!areaCode) {
    return
  }
  areaEcts.set(areaCode, (areaEcts.get(areaCode) ?? 0) + ects)
}

function buildAreaStats(areaEcts: Map<string, number>): SemesterAreaStat[] {
  return [...areaEcts.entries()]
    .map(([areaCode, ects]) => ({
      areaCode,
      label: formatRegulationAreaShortLabel(areaCode),
      ects: roundEcts(ects),
    }))
    .sort((left, right) => right.ects - left.ects || left.label.localeCompare(right.label, 'de'))
}

function buildCompletedCourseStats(completedCourses: CompletedCourse[]): SemesterCardStats {
  const areaEcts = new Map<string, number>()
  let totalEcts = 0

  for (const completedCourse of completedCourses) {
    const ects = completedCourse.ects ?? 0
    totalEcts += ects
    addAreaEcts(areaEcts, completedCourse.studyAreaCode, ects)
  }

  return {
    totalEcts: roundEcts(totalEcts),
    courseCount: completedCourses.length,
    areaStats: buildAreaStats(areaEcts),
  }
}

function buildPlannedCourseStats(
  planDetails: SemesterCardPlanDetails,
  catalogById: Map<string, Course>,
  fallbackCourseCount: number,
): SemesterCardStats {
  const areaEcts = new Map<string, number>()
  const plannedCourseIds = planDetails.courseIds.length > 0
    ? planDetails.courseIds
    : Object.keys(planDetails.courseAssignments)
  let totalEcts = 0

  for (const courseId of plannedCourseIds) {
    const course = catalogById.get(courseId)
    const ects = course?.ects ?? 0
    totalEcts += ects
    addAreaEcts(areaEcts, planDetails.courseAssignments[courseId], ects)
  }

  return {
    totalEcts: roundEcts(totalEcts),
    courseCount: plannedCourseIds.length > 0 ? plannedCourseIds.length : fallbackCourseCount,
    areaStats: buildAreaStats(areaEcts),
  }
}

export function buildSemesterCardStats(
  semesterLabel: string,
  savedPlans: SemesterPlanSummary[],
  completedCourses: CompletedCourse[],
  catalogCourses: Course[],
  assignmentsBySemester: Record<string, Record<string, string>> = {},
  planDetailsBySemester: Record<string, SemesterCardPlanDetails | undefined> = {},
): SemesterCardStats {
  const normalizedLabel = semesterLabel.trim()
  const savedPlan = savedPlans.find((plan) => plan.semesterLabel === normalizedLabel)
  const semesterCompleted = completedCourses.filter((course) => course.semester?.trim() === normalizedLabel)

  const catalogById = new Map(catalogCourses.map((course) => [course.id, course]))
  const planDetails = planDetailsBySemester[normalizedLabel]
  let plannedStats: SemesterCardStats | null = null
  if (planDetails) {
    plannedStats = buildPlannedCourseStats(planDetails, catalogById, savedPlan?.courseCount ?? 0)
  } else {
    const assignments = assignmentsBySemester[normalizedLabel] ?? {}
    const assignmentCourseIds = Object.keys(assignments)
    if (assignmentCourseIds.length > 0) {
      plannedStats = buildPlannedCourseStats(
        { courseIds: assignmentCourseIds, courseAssignments: assignments },
        catalogById,
        savedPlan?.courseCount ?? 0,
      )
    }
  }

  if (semesterCompleted.length > 0) {
    const completedStats = buildCompletedCourseStats(semesterCompleted)
    // Transcript rows should win whenever they explain at least as many visible
    // courses as the saved plan. This prevents stale one-course plan summaries
    // from hiding the completed courses shown after opening a past semester.
    if (!plannedStats || completedStats.courseCount >= plannedStats.courseCount) {
      return completedStats
    }
  }

  if (plannedStats) {
    return plannedStats
  }

  return {
    totalEcts: 0,
    courseCount: savedPlan?.courseCount ?? 0,
    areaStats: [],
  }
}

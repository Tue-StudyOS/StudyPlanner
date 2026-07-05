import type { CompletedCourse, Course } from '../../courses'
import type { SemesterPlanSummary } from '../types.ts'
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

function roundEcts(value: number): number {
  return Math.round(value * 10) / 10
}

export function buildSemesterCardStats(
  semesterLabel: string,
  savedPlans: SemesterPlanSummary[],
  completedCourses: CompletedCourse[],
  catalogCourses: Course[],
  assignmentsBySemester: Record<string, Record<string, string>>,
): SemesterCardStats {
  const normalizedLabel = semesterLabel.trim()
  const savedPlan = savedPlans.find((plan) => plan.semesterLabel === normalizedLabel)
  const semesterCompleted = completedCourses.filter((course) => course.semester?.trim() === normalizedLabel)
  const courseCount = savedPlan?.courseCount ?? semesterCompleted.length
  const catalogById = new Map(catalogCourses.map((course) => [course.id, course]))
  const assignments = assignmentsBySemester[normalizedLabel] ?? {}

  const areaEcts = new Map<string, number>()
  let totalEcts = 0

  if (savedPlan && savedPlan.courseCount > 0) {
    for (const courseId of Object.keys(assignments)) {
      const course = catalogById.get(courseId)
      const ects = course?.ects ?? 0
      totalEcts += ects
      const areaCode = assignments[courseId]
      if (areaCode) {
        areaEcts.set(areaCode, roundEcts((areaEcts.get(areaCode) ?? 0) + ects))
      }
    }
  } else {
    for (const completedCourse of semesterCompleted) {
      const ects = completedCourse.ects ?? 0
      totalEcts += ects
      const areaCode = completedCourse.studyAreaCode
      if (areaCode) {
        areaEcts.set(areaCode, roundEcts((areaEcts.get(areaCode) ?? 0) + ects))
      }
    }
  }

  const areaStats = [...areaEcts.entries()]
    .map(([areaCode, ects]) => ({
      areaCode,
      label: formatRegulationAreaShortLabel(areaCode),
      ects,
    }))
    .sort((left, right) => right.ects - left.ects || left.label.localeCompare(right.label, 'de'))

  return {
    totalEcts: roundEcts(totalEcts),
    courseCount,
    areaStats,
  }
}

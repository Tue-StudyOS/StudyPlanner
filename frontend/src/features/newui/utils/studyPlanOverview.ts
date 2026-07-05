import type { CompletedCourse } from '../../courses'
import { compareSemesterLabels } from '../../planner/utils/semesterLabels.ts'
import type { SemesterGroup } from '../types.ts'

/** Mean of the counted, graded courses; null when nothing is graded yet. */
export function averageOfGrades(courses: CompletedCourse[]): number | null {
  const grades = courses
    .filter((course) => course.grade !== null && course.isGradeCounted !== false)
    .map((course) => course.grade as number)
  if (grades.length === 0) {
    return null
  }
  return grades.reduce((sum, grade) => sum + grade, 0) / grades.length
}

/**
 * Groups completed courses into semester columns, newest first. The current
 * semester always gets a column (even without courses) so it can render as the
 * open "offen" column; current and future semesters are marked open.
 */
export function buildSemesterGroups(
  completedCourses: CompletedCourse[],
  currentSemesterLabel: string,
): SemesterGroup[] {
  const groups = new Map<string, CompletedCourse[]>()
  for (const course of completedCourses) {
    const existing = groups.get(course.semester)
    if (existing) {
      existing.push(course)
    } else {
      groups.set(course.semester, [course])
    }
  }

  if (!groups.has(currentSemesterLabel)) {
    groups.set(currentSemesterLabel, [])
  }

  return [...groups.entries()]
    .map(([label, courses]) => ({
      label,
      courses,
      totalEcts: courses.reduce((sum, course) => sum + course.ects, 0),
      averageGrade: averageOfGrades(courses),
      isOpen: compareSemesterLabels(label, currentSemesterLabel) >= 0,
    }))
    .sort((left, right) => compareSemesterLabels(right.label, left.label))
}

/** German one-decimal grade, e.g. 1.9 -> "1,9"; null -> "–". */
export function formatGrade(grade: number | null): string {
  return grade === null ? '–' : grade.toFixed(1).replace('.', ',')
}

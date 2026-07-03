import type { CompletedCourse } from '../../courses'
import type { StudyStats } from '../types'

// Overarching-competence modules are ungraded and never enter the grade average.
const OVERARCHING_COMPETENCE_CODE = 'UEBK'

type GradeRelevantCourse = Pick<CompletedCourse, 'ects' | 'grade' | 'studyAreaCode'>

/**
 * Client-side equivalent of the backend progress summary, used only while the
 * authoritative snapshot is still loading. Mirrors the backend rules so the
 * transcript header never disagrees with the progress tab: total is the sum of
 * earned ECTS, and the grade average is ECTS-weighted over graded courses with
 * overarching-competence (UEBK) modules excluded (case-insensitive).
 */
export function computeStudyStats(
  completedCourses: GradeRelevantCourse[],
  requiredEcts: number,
): StudyStats {
  const totalEcts = completedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0)
  const progress = requiredEcts > 0 ? Math.round((totalEcts / requiredEcts) * 100) : 0

  const gradedPairs = completedCourses
    .filter(
      (course) =>
        course.grade !== null
        && (course.studyAreaCode ?? '').toUpperCase() !== OVERARCHING_COMPETENCE_CODE,
    )
    .map((course) => ({ grade: course.grade as number, weight: course.ects ?? 0 }))

  const gradedWeight = gradedPairs.reduce((sum, pair) => sum + pair.weight, 0)
  let averageGrade: number | null = null
  if (gradedWeight > 0) {
    averageGrade =
      gradedPairs.reduce((sum, pair) => sum + pair.grade * pair.weight, 0) / gradedWeight
  } else if (gradedPairs.length > 0) {
    // Fall back to an unweighted mean when graded courses carry no ECTS value.
    averageGrade = gradedPairs.reduce((sum, pair) => sum + pair.grade, 0) / gradedPairs.length
  }

  return { totalEcts, requiredEcts, progress, averageGrade }
}

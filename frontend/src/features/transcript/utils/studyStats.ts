import type { CompletedCourse } from '../../courses'
import type { StudyStats } from '../types'
import { isValidTranscriptGrade, truncateDegreeGrade } from './grades.ts'
import { getProjectedDegreeEcts } from '../../../shared/utils/creditProjection.ts'

type GradeRelevantCourse = Pick<CompletedCourse, 'ects' | 'grade' | 'studyAreaCode' | 'assignmentNeedsReview'>
  & Partial<Pick<CompletedCourse, 'degreeCountedEcts' | 'gradeCountedEcts' | 'gradeUsedForAverage' | 'isGradeCounted' | 'isAdditionalAchievement'>>

function fixed(value: number): bigint {
  return BigInt(Math.round(value * 10_000))
}

/** Client fallback while the server progress snapshot is loading. */
export function computeStudyStats(
  completedCourses: GradeRelevantCourse[],
  requiredEcts: number,
): StudyStats {
  const hasDegreeAccounting = completedCourses.some((course) => typeof course.degreeCountedEcts === 'number')
  const hasGradeAccounting = completedCourses.some((course) => typeof course.gradeCountedEcts === 'number'
    || course.gradeUsedForAverage !== undefined || course.isGradeCounted !== undefined)
  const totalEcts = completedCourses.reduce((sum, course) => sum + (hasDegreeAccounting
    ? getProjectedDegreeEcts(course)
    : (course.isAdditionalAchievement ? 0 : course.ects ?? 0)), 0)
  const progress = requiredEcts > 0 ? Math.min(100, Math.round((totalEcts / requiredEcts) * 100)) : 0

  const gradedPairs = completedCourses.flatMap((course) => {
    const grade = course.gradeUsedForAverage ?? course.grade
    if (grade === null || !isValidTranscriptGrade(grade)) return []
    if (hasGradeAccounting) {
      if (course.gradeUsedForAverage === null || course.isGradeCounted === false) return []
      const weight = course.gradeCountedEcts ?? (course.isGradeCounted ? course.degreeCountedEcts ?? 0 : 0)
      return weight > 0 ? [{ grade, weight }] : []
    }
    if (course.assignmentNeedsReview || course.isAdditionalAchievement) return []
    const weight = course.gradeCountedEcts ?? course.degreeCountedEcts ?? course.ects ?? 0
    return weight > 0 ? [{ grade, weight }] : []
  })

  let averageGrade: number | null = null
  if (gradedPairs.length > 0) {
    const weightedGrade = gradedPairs.reduce((sum, pair) => sum + fixed(pair.grade) * fixed(pair.weight), 0n)
    const totalWeight = gradedPairs.reduce((sum, pair) => sum + fixed(pair.weight), 0n)
    if (totalWeight > 0n) {
      const tenths = (weightedGrade * 10n) / (totalWeight * 10_000n)
      averageGrade = Number(tenths) / 10
    }
  }

  return { totalEcts, requiredEcts, progress, averageGrade: averageGrade === null ? null : truncateDegreeGrade(averageGrade) }
}

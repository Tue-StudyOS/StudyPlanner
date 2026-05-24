import { useTranscript } from './useTranscript'
import type { StudyStats } from '../types'

const REQUIRED_ECTS = 120

export function useStudyStats(): StudyStats {
  const { completedCourses } = useTranscript()

  const totalEcts = completedCourses.reduce((sum, completed) => sum + completed.ects, 0)

  const progress = Math.round((totalEcts / REQUIRED_ECTS) * 100)

  const gradedCourses = completedCourses.filter(
    (completedCourse) => completedCourse.grade !== null,
  )

  const averageGrade =
    gradedCourses.length > 0
      ? gradedCourses.reduce((sum, course) => sum + (course.grade ?? 0), 0) / gradedCourses.length
      : null

  return { totalEcts, requiredEcts: REQUIRED_ECTS, progress, averageGrade }
}

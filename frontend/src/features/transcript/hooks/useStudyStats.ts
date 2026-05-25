import { useAuth } from '../../auth'
import { useTranscript } from './useTranscript'
import type { StudyStats } from '../types'

const FALLBACK_REQUIRED_ECTS = 120

export function useStudyStats(): StudyStats {
  const { user } = useAuth()
  const { completedCourses } = useTranscript()

  const totalEcts = completedCourses.reduce((sum, completed) => sum + completed.ects, 0)
  const requiredEcts = user?.profile.totalEcts ?? FALLBACK_REQUIRED_ECTS
  const progress = requiredEcts > 0 ? Math.round((totalEcts / requiredEcts) * 100) : 0

  const gradedCourses = completedCourses.filter(
    (completedCourse) => completedCourse.grade !== null && completedCourse.studyAreaCode !== 'UEBK',
  )

  const averageGrade =
    gradedCourses.length > 0
      ? gradedCourses.reduce((sum, course) => sum + (course.grade ?? 0), 0) / gradedCourses.length
      : null

  return { totalEcts, requiredEcts, progress, averageGrade }
}

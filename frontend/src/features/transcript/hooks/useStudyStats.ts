import { useTranscript } from './useTranscript'
import type { StudyStats } from '../types'

const REQUIRED_ECTS = 120

export function useStudyStats(): StudyStats {
  const { completedCourses } = useTranscript()

  const totalEcts = completedCourses.reduce((sum, completed) => sum + completed.ects, 0)

  const progress = Math.round((totalEcts / REQUIRED_ECTS) * 100)

  const averageGrade =
    completedCourses.length > 0
      ? completedCourses.reduce((sum, c) => sum + c.grade, 0) / completedCourses.length
      : null

  return { totalEcts, requiredEcts: REQUIRED_ECTS, progress, averageGrade }
}

import { useAuth } from '../../auth'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { useTranscript } from './useTranscript'
import { computeStudyStats } from '../utils/studyStats.ts'
import type { StudyStats } from '../types'

const FALLBACK_REQUIRED_ECTS = 120

export function useStudyStats(): StudyStats {
  const { user } = useAuth()
  const { completedCourses } = useTranscript()
  const { progressSnapshot } = useProgressSnapshot()

  // The backend snapshot is the single source of truth; reading it here keeps
  // the transcript header identical to the progress tab (no small drift from a
  // separate computation). While it loads, fall back to an equivalent client
  // calculation so the numbers still appear immediately.
  if (progressSnapshot) {
    return {
      totalEcts: progressSnapshot.summary.totalEcts,
      requiredEcts: progressSnapshot.summary.requiredEcts,
      progress: progressSnapshot.summary.progressPercentage,
      averageGrade: progressSnapshot.summary.averageGrade,
    }
  }

  const requiredEcts = user?.profile.totalEcts ?? FALLBACK_REQUIRED_ECTS
  return computeStudyStats(completedCourses, requiredEcts)
}

import {
  invalidateSessionCache,
  writeSessionCache,
} from '../../../shared/utils/sessionCache.ts'
import { fetchSemesterPlan, saveSemesterPlan } from '../api'
import { SEMESTER_PLAN_CHANGED_EVENT, markSemesterBadge } from './semesterTabBadge.ts'
import { getCurrentSemesterLabel } from './semesterLabels'

export async function addCourseToCurrentSemesterPlan(
  csrfToken: string,
  userCacheKey: string,
  courseId: string,
): Promise<boolean> {
  const semesterLabel = getCurrentSemesterLabel()
  const existingPlan = await fetchSemesterPlan(semesterLabel)
  const courseIds = existingPlan?.courseIds ?? []
  if (courseIds.includes(courseId)) {
    return false
  }

  const savedPlan = await saveSemesterPlan(csrfToken, semesterLabel, {
    title: existingPlan?.title ?? null,
    notes: existingPlan?.notes ?? null,
    courseIds: [...courseIds, courseId],
    hiddenSlotIds: existingPlan?.hiddenSlotIds ?? [],
    courseAssignments: existingPlan?.courseAssignments ?? {},
  })

  writeSessionCache(`private:planner:plan:${semesterLabel}`, savedPlan, userCacheKey)
  invalidateSessionCache('private:planner:index', userCacheKey)

  if (typeof window !== 'undefined') {
    markSemesterBadge()
    window.dispatchEvent(
      new CustomEvent(SEMESTER_PLAN_CHANGED_EVENT, { detail: { semesterLabel } }),
    )
  }

  return true
}

import {
  invalidateSessionCache,
  writeSessionCache,
} from '../../../shared/utils/sessionCache.ts'
import { fetchSemesterPlan, saveSemesterPlan } from '../api'
import type { SemesterPlan } from '../types.ts'
import {
  arePlanCourseIdsEqual,
  dropCourseFromPlanFields,
  keepInterestedCoursesInPlanFields,
} from './currentSemesterPlanMembership.ts'
import { SEMESTER_PLAN_CHANGED_EVENT, markSemesterBadge } from './semesterTabBadge.ts'
import { getCurrentSemesterLabel } from './semesterLabels'

function persistCurrentSemesterPlanCache(
  savedPlan: SemesterPlan,
  userCacheKey: string,
  markAddedBadge: boolean,
): void {
  writeSessionCache(`private:planner:plan:${savedPlan.semesterLabel}`, savedPlan, userCacheKey)
  invalidateSessionCache('private:planner:index', userCacheKey)

  if (typeof window === 'undefined') {
    return
  }
  if (markAddedBadge) {
    markSemesterBadge()
  }
  window.dispatchEvent(
    new CustomEvent(SEMESTER_PLAN_CHANGED_EVENT, { detail: { semesterLabel: savedPlan.semesterLabel } }),
  )
}

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

  persistCurrentSemesterPlanCache(savedPlan, userCacheKey, true)
  return true
}

export async function removeCourseFromCurrentSemesterPlan(
  csrfToken: string,
  userCacheKey: string,
  courseId: string,
): Promise<boolean> {
  const semesterLabel = getCurrentSemesterLabel()
  const existingPlan = await fetchSemesterPlan(semesterLabel)
  if (!existingPlan?.courseIds.includes(courseId)) {
    return false
  }

  const nextFields = dropCourseFromPlanFields(existingPlan, courseId)
  const savedPlan = await saveSemesterPlan(csrfToken, semesterLabel, nextFields)
  persistCurrentSemesterPlanCache(savedPlan, userCacheKey, false)
  return true
}

export async function pruneCurrentSemesterPlanToFavorites(
  csrfToken: string,
  userCacheKey: string,
  favoriteIds: readonly string[],
): Promise<boolean> {
  const semesterLabel = getCurrentSemesterLabel()
  const existingPlan = await fetchSemesterPlan(semesterLabel)
  if (!existingPlan) {
    return false
  }

  const nextFields = keepInterestedCoursesInPlanFields(existingPlan, favoriteIds)
  if (arePlanCourseIdsEqual(existingPlan.courseIds, nextFields.courseIds)) {
    return false
  }

  const savedPlan = await saveSemesterPlan(csrfToken, semesterLabel, nextFields)
  persistCurrentSemesterPlanCache(savedPlan, userCacheKey, false)
  return true
}

import {
  invalidateSessionCache,
  writeSessionCache,
} from '../../../shared/utils/sessionCache.ts'
import { getPlanningSemesterLabel } from '../../courses/utils/catalogOffering.ts'
import { fetchSemesterPlan, saveSemesterPlan } from '../api.ts'
import type { SemesterPlan } from '../types.ts'
import { dropCourseFromPlanFields, type SemesterPlanWriteFields } from './currentSemesterPlanMembership.ts'
import { SEMESTER_PLAN_CHANGED_EVENT, markSemesterBadge } from './semesterTabBadge.ts'

function persistSemesterPlanCache(
  savedPlan: SemesterPlan,
  userCacheKey: string,
  markAddedBadge: boolean,
): void {
  writeSessionCache(`private:planner:plan:${savedPlan.semesterLabel}`, savedPlan, userCacheKey)
  invalidateSessionCache('private:planner:index', userCacheKey)
  if (typeof window === 'undefined') {
    return
  }
  if (markAddedBadge && savedPlan.semesterLabel === getPlanningSemesterLabel()) {
    markSemesterBadge()
  }
  window.dispatchEvent(
    new CustomEvent(SEMESTER_PLAN_CHANGED_EVENT, { detail: { semesterLabel: savedPlan.semesterLabel } }),
  )
}

export async function syncInterestedSemesterPlan(
  csrfToken: string,
  userCacheKey: string,
  semesterLabel: string,
  courseIds: readonly string[],
  isAdding: boolean,
): Promise<void> {
  const existingPlan = await fetchSemesterPlan(semesterLabel)
  const fields: SemesterPlanWriteFields = existingPlan ?? {
    title: null,
    notes: null,
    courseIds: [],
    hiddenSlotIds: [],
    manualSlots: [],
    courseAssignments: {},
  }
  const nextFields = isAdding
    ? { ...fields, courseIds: [...new Set([...fields.courseIds, ...courseIds])] }
    : courseIds.reduce((plan, courseId) => dropCourseFromPlanFields(plan, courseId), fields)
  if (nextFields.courseIds.length === fields.courseIds.length) {
    return
  }
  const savedPlan = await saveSemesterPlan(csrfToken, semesterLabel, nextFields)
  persistSemesterPlanCache(savedPlan, userCacheKey, isAdding)
}

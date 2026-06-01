import { useMemo, useState } from 'react'
import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  getPlannerCourseAreaOptions,
  getResolvedPlannerAssignment,
  getSuggestedPlannerAssignment,
} from '../utils/plannerAssignments'

/** A favorite course prepared for display in the planner favorites panel. */
export interface PlannerFavoriteCandidate {
  course: Course
  isPlanned: boolean
  options: RegulationAreaOption[]
  selectedAreaCode: string | null
  suggestedAreaCode: string | null
}

interface UsePlannerFavoritesParams {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  isEditing: boolean
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  onSetAssignment: (courseId: string, areaCode: string | null) => void
}

interface UsePlannerFavoritesResult {
  candidates: PlannerFavoriteCandidate[]
  selectAssignment: (courseId: string, isPlanned: boolean, areaCode: string | null) => void
}

/**
 * Owns the planner favorites logic: ordering, area resolution and the local
 * assignment drafts. The panel component stays purely presentational.
 */
export function usePlannerFavorites({
  favoriteCourses,
  plannedCourseIds,
  isEditing,
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  onSetAssignment,
}: UsePlannerFavoritesParams): UsePlannerFavoritesResult {
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({})

  const candidates = useMemo<PlannerFavoriteCandidate[]>(() => {
    const isAssignable = (course: Course): boolean =>
      getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups).length > 0

    const sorted = [...favoriteCourses].sort((leftCourse, rightCourse) => {
      // While editing, push courses that can't be added to the plan to the bottom.
      if (isEditing) {
        const leftAssignable = isAssignable(leftCourse)
        const rightAssignable = isAssignable(rightCourse)
        if (leftAssignable !== rightAssignable) {
          return Number(rightAssignable) - Number(leftAssignable)
        }
      }
      const leftIsPlanned = plannedCourseIds.includes(leftCourse.id)
      const rightIsPlanned = plannedCourseIds.includes(rightCourse.id)
      if (leftIsPlanned !== rightIsPlanned) {
        return Number(rightIsPlanned) - Number(leftIsPlanned)
      }
      return leftCourse.title.localeCompare(rightCourse.title)
    })

    return sorted.map((course) => {
      const isPlanned = plannedCourseIds.includes(course.id)
      const options = getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups)
      const suggestedAreaCode = getSuggestedPlannerAssignment(course, {
        studyProgramCode,
        regulationRuleGroups,
        planAssignments,
        plannedCourses,
        completedCourses,
      })
      const draftValue = assignmentDrafts[course.id]
      const selectedAreaCode = draftValue
        ? draftValue
        : isPlanned
          ? getResolvedPlannerAssignment(course, {
              studyProgramCode,
              regulationRuleGroups,
              planAssignments,
              plannedCourses,
              completedCourses,
            })
          : suggestedAreaCode

      return { course, isPlanned, options, selectedAreaCode, suggestedAreaCode }
    })
  }, [
    favoriteCourses,
    plannedCourseIds,
    isEditing,
    studyProgramCode,
    regulationRuleGroups,
    planAssignments,
    plannedCourses,
    completedCourses,
    assignmentDrafts,
  ])

  function selectAssignment(courseId: string, isPlanned: boolean, areaCode: string | null): void {
    if (isPlanned) {
      onSetAssignment(courseId, areaCode)
    }
    setAssignmentDrafts((previousValue) => {
      if (!areaCode) {
        const nextValue = { ...previousValue }
        delete nextValue[courseId]
        return nextValue
      }
      return { ...previousValue, [courseId]: areaCode }
    })
  }

  return { candidates, selectAssignment }
}

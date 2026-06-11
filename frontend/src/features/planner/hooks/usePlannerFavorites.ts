import { useMemo, useState } from 'react'
import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  getCurrentPlannerAssignment,
  getPlannerCourseAreaOptions,
  getResolvedPlannerAssignment,
  getSuggestedPlannerAssignment,
} from '../utils/plannerAssignments'

/** A favorite course prepared for display in the planner favorites panel. */
export interface PlannerFavoriteCandidate {
  course: Course
  isPlanned: boolean
  completedCourse: CompletedCourse | null
  options: RegulationAreaOption[]
  selectedAreaCode: string | null
  explicitAreaCode: string | null
  suggestedAreaCode: string | null
}

interface UsePlannerFavoritesParams {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
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
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  onSetAssignment,
}: UsePlannerFavoritesParams): UsePlannerFavoritesResult {
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({})
  const completedCourseByCatalogKey = useMemo(() => {
    const lookup = new Map<string, CompletedCourse>()

    completedCourses.forEach((course) => {
      if (course.courseId && !lookup.has(course.courseId)) {
        lookup.set(course.courseId, course)
      }
      if (course.courseNumber && !lookup.has(course.courseNumber)) {
        lookup.set(course.courseNumber, course)
      }
      if (course.externalCourseCode && !lookup.has(course.externalCourseCode)) {
        lookup.set(course.externalCourseCode, course)
      }
    })

    return lookup
  }, [completedCourses])

  const candidates = useMemo<PlannerFavoriteCandidate[]>(() => {
    const isAssignable = (course: Course): boolean =>
      getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups).length > 0

    const sorted = [...favoriteCourses].sort((leftCourse, rightCourse) => {
      // Courses that can't be added to the plan sort to the bottom.
      const leftAssignable = isAssignable(leftCourse)
      const rightAssignable = isAssignable(rightCourse)
      if (leftAssignable !== rightAssignable) {
        return Number(rightAssignable) - Number(leftAssignable)
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
      const currentAssignment = isPlanned
        ? getCurrentPlannerAssignment(course, {
            studyProgramCode,
            regulationRuleGroups,
            planAssignments,
          })
        : null
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
      const explicitAreaCode = draftValue ?? currentAssignment

      return {
        course,
        isPlanned,
        completedCourse: completedCourseByCatalogKey.get(course.id) ?? completedCourseByCatalogKey.get(course.number) ?? null,
        options,
        selectedAreaCode,
        explicitAreaCode,
        suggestedAreaCode,
      }
    })
  }, [
    favoriteCourses,
    plannedCourseIds,
    studyProgramCode,
    regulationRuleGroups,
    planAssignments,
    plannedCourses,
    completedCourses,
    completedCourseByCatalogKey,
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

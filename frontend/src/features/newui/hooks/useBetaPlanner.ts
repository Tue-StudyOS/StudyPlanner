import { useMemo } from 'react'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import type { Course, MasterCat } from '../../courses'
import { ALL_CATALOG_PERIODS, findCatalogPeriodForSemesterLabel, useCatalogCourses, useCatalogPeriods } from '../../courses'
import { useFavorites } from '../../favorites'
import { useSemesterPlanner } from '../../planner/hooks/useSemesterPlanner'
import {
  getPlannerCourseAreaOptions,
  getSuggestedPlannerAssignment,
  resolveChosenInfoAlternativeAreaCode,
} from '../../planner/utils/plannerAssignments.ts'
import {
  defaultHiddenTutorialSlotIds,
  getTutorialSlotOptions,
  hiddenSlotIdsForTutorialSelection,
} from '../../planner/utils/plannerSlotSelection.ts'
import { useTranscript } from '../../transcript'
import { areaCodeForCategory, categoriesFromOptions } from '../utils/plannerCategory'

export interface CategoryControl {
  categoryOf: (course: Course) => MasterCat | null
  selectableOf: (course: Course) => MasterCat[]
  change: (course: Course, category: MasterCat) => void
}

export interface BetaPlannerResult {
  activeSemesterLabel: string
  favoriteCourses: Course[]
  plannedCourses: Course[]
  plannedCourseIds: string[]
  hiddenSlotIds: string[]
  isLoading: boolean
  /** Planned ECTS per regulation-area code (assigned or suggested). */
  plannedEctsByArea: Map<string, number>
  categoryControl: CategoryControl
  addCourse: (courseId: string) => void
  removeCourse: (courseId: string) => void
  toggleFavorite: (courseId: string) => void
  selectTutorialSlot: (courseId: string, slotId: string) => void
}

/**
 * Beta-page planner: reuses the existing semester-plan state, favorites, catalog
 * and planner area-assignment logic; only the presentation is new.
 */
export function useBetaPlanner(): BetaPlannerResult {
  const { user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { completedCourses } = useTranscript()
  const { regulationVersion } = useRegulationVersion(user?.profile.regulationVersionCode)
  const {
    activeSemesterLabel,
    plannedCourseIds,
    hiddenSlotIds,
    planAssignments,
    isLoadingSemesterPlan,
    setPlannedCourseIds,
    setHiddenSlotIds,
    setAssignment,
  } = useSemesterPlanner()

  const { periods } = useCatalogPeriods()
  const activePeriodId = useMemo(
    () => findCatalogPeriodForSemesterLabel(periods, activeSemesterLabel)?.periodId,
    [periods, activeSemesterLabel],
  )
  const { courses, isLoading } = useCatalogCourses('', 500, activePeriodId)
  const { courses: allCatalogCourses } = useCatalogCourses('', 1000, ALL_CATALOG_PERIODS)

  const courseById = useMemo(
    () => new Map([...allCatalogCourses, ...courses].map((course) => [course.id, course])),
    [allCatalogCourses, courses],
  )

  const favoriteCourses = useMemo(() => {
    const byId = new Map<string, Course>()
    for (const course of [...courses, ...allCatalogCourses]) {
      if (favoriteIds.includes(course.id) && !byId.has(course.id)) {
        byId.set(course.id, course)
      }
    }
    return [...byId.values()].sort((left, right) => left.title.localeCompare(right.title))
  }, [courses, allCatalogCourses, favoriteIds])

  const plannedCourses = useMemo(
    () =>
      plannedCourseIds
        .map((courseId) => courseById.get(courseId))
        .filter((course): course is Course => course !== undefined),
    [plannedCourseIds, courseById],
  )

  const studyProgramCode = user?.profile.studyProgramCode ?? null
  const ruleGroups = useMemo(() => regulationVersion?.ruleGroups ?? [], [regulationVersion?.ruleGroups])
  const chosenInfoAlternativeCode = useMemo(
    () =>
      resolveChosenInfoAlternativeAreaCode({
        plannedCourses,
        completedCourses,
        studyProgramCode,
        regulationRuleGroups: ruleGroups,
      }),
    [plannedCourses, completedCourses, studyProgramCode, ruleGroups],
  )

  const optionsFor = (course: Course) =>
    getPlannerCourseAreaOptions(course, studyProgramCode, ruleGroups, chosenInfoAlternativeCode)

  const resolvedAreaCode = (course: Course): string | null =>
    planAssignments[course.id] ??
    getSuggestedPlannerAssignment(course, {
      studyProgramCode,
      regulationRuleGroups: ruleGroups,
      planAssignments,
      plannedCourses,
      completedCourses,
      chosenInfoAlternativeCode,
    })

  const categoryControl: CategoryControl = {
    categoryOf: (course) => {
      const code = resolvedAreaCode(course)
      if (!code) {
        return null
      }
      return optionsFor(course).find((option) => option.code === code)?.masterCat ?? null
    },
    selectableOf: (course) => categoriesFromOptions(optionsFor(course)),
    change: (course, category) => {
      const code = areaCodeForCategory(optionsFor(course), category)
      if (code) {
        setAssignment(course.id, code)
      }
    },
  }

  const plannedEctsByArea = useMemo(() => {
    const map = new Map<string, number>()
    for (const course of plannedCourses) {
      const code =
        planAssignments[course.id] ??
        getSuggestedPlannerAssignment(course, {
          studyProgramCode,
          regulationRuleGroups: ruleGroups,
          planAssignments,
          plannedCourses,
          completedCourses,
          chosenInfoAlternativeCode,
        })
      if (!code) {
        continue
      }
      map.set(code, (map.get(code) ?? 0) + (course.ects ?? 0))
    }
    return map
  }, [plannedCourses, planAssignments, studyProgramCode, ruleGroups, completedCourses, chosenInfoAlternativeCode])

  function addCourse(courseId: string): void {
    if (!plannedCourseIds.includes(courseId)) {
      setPlannedCourseIds([...plannedCourseIds, courseId])
    }
    const course = courseById.get(courseId) ?? null
    const defaultHidden = course ? defaultHiddenTutorialSlotIds(getTutorialSlotOptions(course)) : []
    setHiddenSlotIds([
      ...hiddenSlotIds.filter((slotId) => !slotId.startsWith(`${courseId}:`)),
      ...defaultHidden,
    ])
  }

  function removeCourse(courseId: string): void {
    setPlannedCourseIds(plannedCourseIds.filter((id) => id !== courseId))
    setHiddenSlotIds(hiddenSlotIds.filter((slotId) => !slotId.startsWith(`${courseId}:`)))
    setAssignment(courseId, null)
  }

  function selectTutorialSlot(courseId: string, selectedSlotId: string): void {
    const course = courseById.get(courseId)
    if (!course) {
      return
    }
    const tutorialSlotIds = getTutorialSlotOptions(course).map((option) => option.slotId)
    const nextHidden = hiddenSlotIdsForTutorialSelection(tutorialSlotIds, selectedSlotId)
    setHiddenSlotIds([
      ...hiddenSlotIds.filter((slotId) => !slotId.startsWith(`${courseId}:`)),
      ...nextHidden,
    ])
  }

  return {
    activeSemesterLabel,
    favoriteCourses,
    plannedCourses,
    plannedCourseIds,
    hiddenSlotIds,
    isLoading: isLoadingSemesterPlan || isLoading,
    plannedEctsByArea,
    categoryControl,
    addCourse,
    removeCourse,
    toggleFavorite,
    selectTutorialSlot,
  }
}

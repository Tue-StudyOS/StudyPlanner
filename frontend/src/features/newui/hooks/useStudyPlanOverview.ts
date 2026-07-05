import { useCallback, useMemo } from 'react'
import type { CompletedCourse, MasterCat } from '../../courses'
import type { ProgressSummary, RegulationAreaProgress } from '../../dashboard/types'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'
import { useTranscript } from '../../transcript'
import type { SemesterGroup } from '../types'
import { buildCategoryAreaMap, selectableCategoriesFromMap } from '../utils/categoryAssignment'
import { buildSemesterGroups } from '../utils/studyPlanOverview'

interface UseStudyPlanOverviewResult {
  summary: ProgressSummary | null
  semesters: SemesterGroup[]
  regulationAreas: RegulationAreaProgress[]
  /** Categories the study program supports — the ones a course can be moved to. */
  selectableCategories: MasterCat[]
  isLoading: boolean
  changeCourseCategory: (course: CompletedCourse, masterCat: MasterCat) => void
}

/**
 * Read model for the beta study-plan page. It reuses the existing transcript and
 * progress data unchanged — only the shaping (semester grouping) is added here.
 */
export function useStudyPlanOverview(): UseStudyPlanOverviewResult {
  const { completedCourses, isLoadingCompletedCourses, setCategory, updateCourse } = useTranscript()
  const { progressSnapshot, isLoadingProgress } = useProgressSnapshot()

  const semesters = useMemo(
    () => buildSemesterGroups(completedCourses, getCurrentSemesterLabel()),
    [completedCourses],
  )

  const regulationAreas = useMemo(
    () => progressSnapshot?.regulationProgress ?? [],
    [progressSnapshot],
  )

  // A category is assignable by setting the study-area code that maps to it —
  // the backend derives the category from that area. Catalog-matched courses
  // accept any regulation area, so the choices come from the program's areas.
  const categoryAreaMap = useMemo(() => buildCategoryAreaMap(regulationAreas), [regulationAreas])
  const selectableCategories = useMemo(
    () => selectableCategoriesFromMap(categoryAreaMap),
    [categoryAreaMap],
  )

  const changeCourseCategory = useCallback(
    (course: CompletedCourse, masterCat: MasterCat): void => {
      const areaCode = categoryAreaMap.get(masterCat)
      if (areaCode) {
        // Set masterCat too so the UI reflects the change immediately; the server
        // re-derives the same category from the study-area code on save.
        void updateCourse(course.id, { studyAreaCode: areaCode, masterCat })
      } else {
        void setCategory(course.id, masterCat)
      }
    },
    [categoryAreaMap, setCategory, updateCourse],
  )

  return {
    summary: progressSnapshot?.summary ?? null,
    semesters,
    regulationAreas,
    selectableCategories,
    isLoading: isLoadingCompletedCourses || isLoadingProgress,
    changeCourseCategory,
  }
}

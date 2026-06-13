import { buildRelevantCourseAreaOptions } from '../../../shared/utils/regulation.ts'
import type { Course, MasterCat } from '../types'

export interface CourseCardTagOrder {
  seasonFirst: true
  typeLabels: string[]
  categoryLabels: MasterCat[]
}

export interface CourseAreaTag {
  key: string
  label: string
  masterCat: MasterCat | null
}

/**
 * Study-area tags shown on a course, adapted to the active examination
 * regulation: when a study program is selected the tags come from that
 * program's area mapping (e.g. "DIVERSE" for M.Sc. Machine Learning), so they
 * never show another regulation's categories. Without a selected program the
 * broad master categories are used as a public-catalog fallback.
 */
export function buildCourseAreaTags(
  course: Pick<Course, 'masterCats' | 'studyAreaOptions'>,
  studyProgramCode: string | null,
): CourseAreaTag[] {
  if (studyProgramCode) {
    const regulationOptions = buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode)
    if (regulationOptions.length > 0) {
      return regulationOptions.map((option) => ({
        key: option.code,
        label: option.shortLabel,
        masterCat: option.masterCat,
      }))
    }
  }
  return course.masterCats.map((masterCat) => ({
    key: masterCat,
    label: masterCat,
    masterCat,
  }))
}

export interface CompletedCourseCardVisibility {
  showTitle: true
  showSeason: true
  showEcts: true
  showCompletedLabel: boolean
  showSecondaryDetails: boolean
}

export function buildCourseCardTagOrder(course: Pick<Course, 'types' | 'masterCats'>): CourseCardTagOrder {
  return {
    seasonFirst: true,
    typeLabels: course.types,
    categoryLabels: course.masterCats,
  }
}

export function getCompletedCourseCardVisibility(isCompleted: boolean): CompletedCourseCardVisibility {
  return {
    showTitle: true,
    showSeason: true,
    showEcts: true,
    showCompletedLabel: isCompleted,
    showSecondaryDetails: !isCompleted,
  }
}

import type { Course, MasterCat } from '../types'

export interface CourseCardTagOrder {
  seasonFirst: true
  typeLabels: string[]
  categoryLabels: MasterCat[]
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

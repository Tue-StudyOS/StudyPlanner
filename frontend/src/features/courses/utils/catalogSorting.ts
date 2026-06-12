import type { Course } from '../types'
import { cleanCourseTitle } from './courseTitle.ts'

export type CatalogSortOption = 'title' | 'ects-asc' | 'ects-desc' | 'lecturer'

export const CATALOG_SORT_LABELS: Record<CatalogSortOption, string> = {
  title: 'Title A–Z',
  'ects-asc': 'ECTS low to high',
  'ects-desc': 'ECTS high to low',
  lecturer: 'Professor A–Z',
}

function compareTitles(left: Course, right: Course): number {
  return cleanCourseTitle(left.title, left.number).localeCompare(cleanCourseTitle(right.title, right.number), 'de')
}

function compareEcts(left: Course, right: Course, direction: 1 | -1): number {
  // Courses without ECTS data always sort last, regardless of direction.
  if (left.ects === null && right.ects === null) {
    return compareTitles(left, right)
  }
  if (left.ects === null) {
    return 1
  }
  if (right.ects === null) {
    return -1
  }
  const difference = (left.ects - right.ects) * direction
  return difference !== 0 ? difference : compareTitles(left, right)
}

function compareLecturers(left: Course, right: Course): number {
  const leftLecturer = left.lecturer.trim()
  const rightLecturer = right.lecturer.trim()
  if (!leftLecturer && !rightLecturer) {
    return compareTitles(left, right)
  }
  if (!leftLecturer) {
    return 1
  }
  if (!rightLecturer) {
    return -1
  }
  const difference = leftLecturer.localeCompare(rightLecturer, 'de')
  return difference !== 0 ? difference : compareTitles(left, right)
}

export function sortCatalogCourses(courses: Course[], sortOption: CatalogSortOption): Course[] {
  const sortedCourses = [...courses]
  switch (sortOption) {
    case 'ects-asc':
      return sortedCourses.sort((left, right) => compareEcts(left, right, 1))
    case 'ects-desc':
      return sortedCourses.sort((left, right) => compareEcts(left, right, -1))
    case 'lecturer':
      return sortedCourses.sort(compareLecturers)
    default:
      return sortedCourses.sort(compareTitles)
  }
}

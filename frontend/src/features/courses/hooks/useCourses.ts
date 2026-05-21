import coursesData from '@data/courses.json'
import type { CompletedCourse, Course, MasterCategoryMeta } from '../types'

interface CoursesData {
  courses: Course[]
  completedCourses: CompletedCourse[]
  masterCategoryMeta: MasterCategoryMeta
}

const data = coursesData as CoursesData

export const initialCompletedCourses: CompletedCourse[] = data.completedCourses

export function useCourses(): { courses: Course[]; masterCategoryMeta: MasterCategoryMeta } {
  return { courses: data.courses, masterCategoryMeta: data.masterCategoryMeta }
}

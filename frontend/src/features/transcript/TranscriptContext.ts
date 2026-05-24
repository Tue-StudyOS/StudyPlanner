import { createContext } from 'react'
import type { CompletedCourse, MasterCat } from '../courses'

export interface TranscriptContextValue {
  completedCourses: CompletedCourse[]
  isLoadingCompletedCourses: boolean
  isSavingCompletedCourses: boolean
  completedCoursesError: string | null
  addCompletedCourse: (course: CompletedCourse) => void
  removeCourse: (courseId: string) => void
  setCategory: (courseId: string, masterCat: MasterCat) => void
  updateCourse: (courseId: string, updates: Partial<CompletedCourse>) => void
}

export const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined)

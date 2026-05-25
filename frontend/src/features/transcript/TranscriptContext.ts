import { createContext } from 'react'
import type { CompletedCourse, MasterCat } from '../courses'
import type { BulkCompletedCourseImportItem, BulkCompletedCourseImportResult, TranscriptSaveResult } from './types'

export interface TranscriptContextValue {
  completedCourses: CompletedCourse[]
  isLoadingCompletedCourses: boolean
  isSavingCompletedCourses: boolean
  completedCoursesError: string | null
  addCompletedCourse: (course: CompletedCourse) => Promise<TranscriptSaveResult>
  addCompletedCourses: (courses: CompletedCourse[]) => Promise<TranscriptSaveResult>
  importCompletedCourses: (items: BulkCompletedCourseImportItem[]) => Promise<BulkCompletedCourseImportResult | null>
  removeCourse: (courseId: string) => Promise<boolean>
  setCategory: (courseId: string, masterCat: MasterCat) => Promise<boolean>
  updateCourse: (courseId: string, updates: Partial<CompletedCourse>) => Promise<boolean>
  clearCompletedCoursesError: () => void
}

export const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined)

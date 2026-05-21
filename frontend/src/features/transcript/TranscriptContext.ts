import { createContext } from 'react'
import type { CompletedCourse, MasterCat } from '../courses'

export interface TranscriptContextValue {
  completedCourses: CompletedCourse[]
  removeCourse: (courseId: string) => void
  setCategory: (courseId: string, masterCat: MasterCat) => void
}

export const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined)

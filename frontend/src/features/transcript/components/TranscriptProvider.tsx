import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { CompletedCourse, MasterCat } from '../../courses'
import { INITIAL_COMPLETED_COURSES } from '../initialCompletedCourses'
import { TranscriptContext } from '../TranscriptContext'

const STORAGE_KEY = 'transcript'

function loadCompletedCourses(): CompletedCourse[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return INITIAL_COMPLETED_COURSES
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? (parsed as CompletedCourse[]) : INITIAL_COMPLETED_COURSES
  } catch {
    return INITIAL_COMPLETED_COURSES
  }
}

interface TranscriptProviderProps {
  children: ReactNode
}

export function TranscriptProvider({ children }: TranscriptProviderProps): JSX.Element {
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>(loadCompletedCourses)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedCourses))
  }, [completedCourses])

  const removeCourse = (courseId: string): void => {
    setCompletedCourses((prev) => prev.filter((c) => c.id !== courseId))
  }

  const setCategory = (courseId: string, masterCat: MasterCat): void => {
    setCompletedCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, masterCat } : c)),
    )
  }

  return (
    <TranscriptContext.Provider value={{ completedCourses, removeCourse, setCategory }}>
      {children}
    </TranscriptContext.Provider>
  )
}

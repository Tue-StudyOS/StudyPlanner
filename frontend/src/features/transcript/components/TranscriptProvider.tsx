import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { useAuth } from '../../auth'
import type { CompletedCourse, MasterCat } from '../../courses'
import { fetchCompletedCourses, saveCompletedCourses } from '../api'
import { TranscriptContext } from '../TranscriptContext'

interface TranscriptProviderProps {
  children: ReactNode
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to synchronize completed courses.'
}

export function TranscriptProvider({ children }: TranscriptProviderProps): JSX.Element {
  const { token } = useAuth()
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([])
  const [isLoadingCompletedCourses, setIsLoadingCompletedCourses] = useState<boolean>(false)
  const [isSavingCompletedCourses, setIsSavingCompletedCourses] = useState<boolean>(false)
  const [completedCoursesError, setCompletedCoursesError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCompletedCourses(): Promise<void> {
      if (!token) {
        if (isActive) {
          setCompletedCourses([])
          setCompletedCoursesError(null)
          setIsLoadingCompletedCourses(false)
        }
        return
      }

      setIsLoadingCompletedCourses(true)
      setCompletedCoursesError(null)
      try {
        const nextCompletedCourses = await fetchCompletedCourses(token)
        if (!isActive) {
          return
        }
        setCompletedCourses(nextCompletedCourses)
      } catch (error) {
        if (isActive) {
          setCompletedCourses([])
          setCompletedCoursesError(normalizeErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoadingCompletedCourses(false)
        }
      }
    }

    void loadCompletedCourses()

    return () => {
      isActive = false
    }
  }, [token])

  function persistCompletedCourses(nextCompletedCourses: CompletedCourse[]): void {
    if (!token) {
      setCompletedCoursesError('Sign in to save completed courses and progress.')
      return
    }

    const previousCompletedCourses = completedCourses
    setCompletedCourses(nextCompletedCourses)
    setCompletedCoursesError(null)
    setIsSavingCompletedCourses(true)

    void saveCompletedCourses(token, nextCompletedCourses)
      .then((savedCompletedCourses) => {
        setCompletedCourses(savedCompletedCourses)
      })
      .catch((error) => {
        setCompletedCourses(previousCompletedCourses)
        setCompletedCoursesError(normalizeErrorMessage(error))
      })
      .finally(() => {
        setIsSavingCompletedCourses(false)
      })
  }

  const addCompletedCourse = (course: CompletedCourse): void => {
    if (
      course.courseId &&
      completedCourses.some((completedCourse) => completedCourse.courseId === course.courseId)
    ) {
      setCompletedCoursesError('This course is already listed as completed.')
      return
    }

    persistCompletedCourses([...completedCourses, course])
  }

  const removeCourse = (courseId: string): void => {
    persistCompletedCourses(completedCourses.filter((course) => course.id !== courseId))
  }

  const setCategory = (courseId: string, masterCat: MasterCat): void => {
    persistCompletedCourses(
      completedCourses.map((course) =>
        course.id === courseId ? { ...course, masterCat } : course,
      ),
    )
  }

  const updateCourse = (courseId: string, updates: Partial<CompletedCourse>): void => {
    persistCompletedCourses(
      completedCourses.map((course) =>
        course.id === courseId ? { ...course, ...updates } : course,
      ),
    )
  }

  return (
    <TranscriptContext.Provider
      value={{
        completedCourses,
        isLoadingCompletedCourses,
        isSavingCompletedCourses,
        completedCoursesError,
        addCompletedCourse,
        removeCourse,
        setCategory,
        updateCourse,
      }}
    >
      {children}
    </TranscriptContext.Provider>
  )
}

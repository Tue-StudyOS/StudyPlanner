import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { useAuth } from '../../auth'
import type { CompletedCourse, MasterCat } from '../../courses'
import { fetchCompletedCourses, importCompletedCourses, saveCompletedCourses } from '../api'
import { TranscriptContext } from '../TranscriptContext'
import type {
  BulkCompletedCourseImportItem,
  BulkCompletedCourseImportResult,
  TranscriptSaveResult,
} from '../types'

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

function normalizeCompletedCourseKey(course: Pick<CompletedCourse, 'courseId' | 'title' | 'semester' | 'ects' | 'grade'>): string {
  if (course.courseId) {
    return `course:${course.courseId}`
  }

  return [
    'manual',
    course.title.trim().toLowerCase(),
    course.semester.trim().toLowerCase(),
    String(course.ects),
    course.grade === null ? 'no-grade' : String(course.grade),
  ].join(':')
}

function emptySaveResult(): TranscriptSaveResult {
  return {
    saved: false,
    addedCount: 0,
    skippedDuplicateCount: 0,
    errorMessage: null,
  }
}

function shouldFallbackTranscriptImport(error: unknown): boolean {
  return error instanceof ApiError
    && (error.code === 'network_error' || error.status === 404 || error.status === 405 || error.status >= 500)
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

  async function persistCompletedCourses(nextCompletedCourses: CompletedCourse[]): Promise<{
    saved: boolean
    errorMessage: string | null
  }> {
    if (!token) {
      const errorMessage = 'Sign in to save completed courses and progress.'
      setCompletedCoursesError(errorMessage)
      return { saved: false, errorMessage }
    }

    const previousCompletedCourses = completedCourses
    setCompletedCourses(nextCompletedCourses)
    setCompletedCoursesError(null)
    setIsSavingCompletedCourses(true)

    try {
      const savedCompletedCourses = await saveCompletedCourses(token, nextCompletedCourses)
      setCompletedCourses(savedCompletedCourses)
      return { saved: true, errorMessage: null }
    } catch (error) {
      const errorMessage = normalizeErrorMessage(error)
      setCompletedCourses(previousCompletedCourses)
      setCompletedCoursesError(errorMessage)
      return { saved: false, errorMessage }
    } finally {
      setIsSavingCompletedCourses(false)
    }
  }

  async function addCompletedCourses(courses: CompletedCourse[]): Promise<TranscriptSaveResult> {
    if (courses.length === 0) {
      return emptySaveResult()
    }

    const existingKeys = new Set(completedCourses.map(normalizeCompletedCourseKey))
    const seenNewKeys = new Set<string>()
    const nextCoursesToAppend: CompletedCourse[] = []

    for (const course of courses) {
      const key = normalizeCompletedCourseKey(course)
      if (existingKeys.has(key) || seenNewKeys.has(key)) {
        continue
      }
      seenNewKeys.add(key)
      nextCoursesToAppend.push(course)
    }

    const skippedDuplicateCount = courses.length - nextCoursesToAppend.length
    if (nextCoursesToAppend.length === 0) {
      setCompletedCoursesError('The selected course data is already stored in your completed-course list.')
      return {
        saved: false,
        addedCount: 0,
        skippedDuplicateCount,
        errorMessage: 'The selected course data is already stored in your completed-course list.',
      }
    }

    const persistResult = await persistCompletedCourses([...completedCourses, ...nextCoursesToAppend])
    return {
      saved: persistResult.saved,
      addedCount: persistResult.saved ? nextCoursesToAppend.length : 0,
      skippedDuplicateCount,
      errorMessage: persistResult.errorMessage,
    }
  }

  async function addCompletedCourse(course: CompletedCourse): Promise<TranscriptSaveResult> {
    return await addCompletedCourses([course])
  }

  async function importCompletedCoursesViaFallback(
    authToken: string,
    items: BulkCompletedCourseImportItem[],
  ): Promise<BulkCompletedCourseImportResult> {
    const existingKeys = new Set(completedCourses.map(normalizeCompletedCourseKey))
    const seenNewKeys = new Set<string>()
    const nextCompletedCourses = [...completedCourses]
    const imported: BulkCompletedCourseImportResult['imported'] = []
    const skippedDuplicates: BulkCompletedCourseImportResult['skippedDuplicates'] = []

    for (const item of items) {
      const key = normalizeCompletedCourseKey(item.course)
      if (existingKeys.has(key) || seenNewKeys.has(key)) {
        skippedDuplicates.push({
          id: item.id,
          message: 'The selected course data is already stored in your completed-course list.',
        })
        continue
      }

      existingKeys.add(key)
      seenNewKeys.add(key)
      nextCompletedCourses.push(item.course)
      imported.push({ id: item.id, message: 'Imported successfully.' })
    }

    if (imported.length === 0) {
      return {
        completedCourses,
        imported,
        skippedDuplicates,
        failed: [],
      }
    }

    const savedCompletedCourses = await saveCompletedCourses(authToken, nextCompletedCourses)
    setCompletedCourses(savedCompletedCourses)
    return {
      completedCourses: savedCompletedCourses,
      imported,
      skippedDuplicates,
      failed: [],
    }
  }

  async function importCompletedCourseItems(
    items: BulkCompletedCourseImportItem[],
  ): Promise<BulkCompletedCourseImportResult | null> {
    if (items.length === 0) {
      return {
        completedCourses,
        imported: [],
        skippedDuplicates: [],
        failed: [],
      }
    }

    if (!token) {
      setCompletedCoursesError('Sign in to save completed courses and progress.')
      return null
    }

    setCompletedCoursesError(null)
    setIsSavingCompletedCourses(true)
    try {
      const result = await importCompletedCourses(token, items)
      setCompletedCourses(result.completedCourses)
      return result
    } catch (error) {
      if (shouldFallbackTranscriptImport(error)) {
        try {
          return await importCompletedCoursesViaFallback(token, items)
        } catch (fallbackError) {
          setCompletedCoursesError(normalizeErrorMessage(fallbackError))
          return null
        }
      }

      setCompletedCoursesError(normalizeErrorMessage(error))
      return null
    } finally {
      setIsSavingCompletedCourses(false)
    }
  }

  async function removeCourse(courseId: string): Promise<boolean> {
    const persistResult = await persistCompletedCourses(
      completedCourses.filter((course) => course.id !== courseId),
    )
    return persistResult.saved
  }

  async function setCategory(courseId: string, masterCat: MasterCat): Promise<boolean> {
    const persistResult = await persistCompletedCourses(
      completedCourses.map((course) =>
        course.id === courseId ? { ...course, masterCat } : course,
      ),
    )
    return persistResult.saved
  }

  async function updateCourse(courseId: string, updates: Partial<CompletedCourse>): Promise<boolean> {
    const persistResult = await persistCompletedCourses(
      completedCourses.map((course) =>
        course.id === courseId ? { ...course, ...updates } : course,
      ),
    )
    return persistResult.saved
  }

  function clearCompletedCoursesError(): void {
    setCompletedCoursesError(null)
  }

  return (
    <TranscriptContext.Provider
      value={{
        completedCourses,
        isLoadingCompletedCourses,
        isSavingCompletedCourses,
        completedCoursesError,
        addCompletedCourse,
        addCompletedCourses,
        importCompletedCourses: importCompletedCourseItems,
        removeCourse,
        setCategory,
        updateCourse,
        clearCompletedCoursesError,
      }}
    >
      {children}
    </TranscriptContext.Provider>
  )
}

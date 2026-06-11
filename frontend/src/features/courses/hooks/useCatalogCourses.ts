import { useEffect, useState } from 'react'
import { fetchCatalogCourses } from '../api'
import type { Course } from '../types'

export function useCatalogCourses(search: string, limit: number = 200, periodId?: string): {
  courses: Course[]
  isLoading: boolean
  error: string | null
} {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCourses(): Promise<void> {
      setIsLoading(true)
      setError(null)
      try {
        const nextCourses = await fetchCatalogCourses(search, limit, periodId)
        if (!isActive) {
          return
        }
        setCourses(nextCourses)
      } catch (loadError) {
        if (!isActive) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : 'Failed to load courses.'
        setError(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadCourses()

    return () => {
      isActive = false
    }
  }, [limit, periodId, search])

  return { courses, isLoading, error }
}

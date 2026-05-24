import { useEffect, useState } from 'react'
import { fetchCatalogCourseDetail } from '../api'
import type { Course } from '../types'

export function useCatalogCourseDetail(courseId: string | undefined): {
  course: Course | null
  isLoading: boolean
  error: string | null
} {
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCourse(): Promise<void> {
      if (!courseId) {
        setCourse(null)
        setIsLoading(false)
        setError('Missing course id.')
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const nextCourse = await fetchCatalogCourseDetail(courseId)
        if (!isActive) {
          return
        }
        setCourse(nextCourse)
      } catch (loadError) {
        if (!isActive) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : 'Failed to load course.'
        setError(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadCourse()

    return () => {
      isActive = false
    }
  }, [courseId])

  return { course, isLoading, error }
}

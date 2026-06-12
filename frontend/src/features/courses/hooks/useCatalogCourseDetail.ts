import { useEffect, useState } from 'react'
import { readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'
import { fetchCatalogCourseDetail } from '../api'
import type { Course } from '../types'

function buildCacheKey(courseId: string): string {
  return `catalog:course-detail:${courseId}`
}

export function useCatalogCourseDetail(courseId: string | undefined): {
  course: Course | null
  isLoading: boolean
  error: string | null
} {
  const cacheKey = courseId ? buildCacheKey(courseId) : null
  const cachedCourse = cacheKey ? readSessionCache<Course>(cacheKey) : null
  const [course, setCourse] = useState<Course | null>(cachedCourse)
  const [isLoading, setIsLoading] = useState<boolean>(!cachedCourse)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCourse(): Promise<void> {
      if (!courseId || !cacheKey) {
        setCourse(null)
        setIsLoading(false)
        setError('Missing course id.')
        return
      }

      const cached = readSessionCache<Course>(cacheKey)
      if (cached) {
        setCourse(cached)
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const nextCourse = await fetchCatalogCourseDetail(courseId)
        if (!isActive) {
          return
        }
        writeSessionCache(cacheKey, nextCourse)
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
  }, [cacheKey, courseId])

  return { course, isLoading, error }
}

import { useEffect, useState } from 'react'
import { readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'
import { toUserFacingApiMessage } from '../../../shared/utils/userFacingApiError.ts'
import { fetchCatalogCourses } from '../api'
import type { Course } from '../types'

// Typing in the search box should not fire one request per keystroke.
const SEARCH_DEBOUNCE_MS = 250

interface CatalogQueryState {
  cacheKey: string
  courses: Course[]
  isLoading: boolean
  error: string | null
  refreshWarning: string | null
}

function buildCacheKey(search: string, limit: number, periodId?: string): string {
  return `catalog:courses:${search}::${limit}::${periodId ?? ''}`
}

export function useCatalogCourses(search: string, limit: number = 200, periodId?: string): {
  courses: Course[]
  isLoading: boolean
  error: string | null
  refreshWarning: string | null
} {
  const cacheKey = buildCacheKey(search, limit, periodId)
  const [state, setState] = useState<CatalogQueryState>(() => {
    const cached = readSessionCache<Course[]>(cacheKey)
    return {
      cacheKey,
      courses: cached ?? [],
      isLoading: !cached,
      error: null,
      refreshWarning: null,
    }
  })

  if (state.cacheKey !== cacheKey) {
    const cached = readSessionCache<Course[]>(cacheKey)
    setState({
      cacheKey,
      courses: cached ?? state.courses,
      isLoading: !cached,
      error: null,
      refreshWarning: null,
    })
  }

  useEffect(() => {
    if (readSessionCache<Course[]>(cacheKey)) {
      return
    }

    let isActive = true

    async function loadCourses(): Promise<void> {
      try {
        const nextCourses = await fetchCatalogCourses(search, limit, periodId)
        if (!isActive) {
          return
        }
        writeSessionCache(cacheKey, nextCourses)
        setState((current) =>
          current.cacheKey === cacheKey
            ? { cacheKey, courses: nextCourses, isLoading: false, error: null, refreshWarning: null }
            : current,
        )
      } catch (loadError) {
        if (!isActive) {
          return
        }
        const message = toUserFacingApiMessage(loadError)
        setState((current) =>
          current.cacheKey === cacheKey
            ? {
                cacheKey,
                courses: current.courses,
                isLoading: false,
                error: current.courses.length > 0 ? null : message,
                refreshWarning: current.courses.length > 0 ? message : null,
              }
            : current,
        )
      }
    }

    const timeoutId = window.setTimeout(() => void loadCourses(), search ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [cacheKey, limit, periodId, search])

  return {
    courses: state.courses,
    isLoading: state.isLoading,
    error: state.error,
    refreshWarning: state.refreshWarning,
  }
}

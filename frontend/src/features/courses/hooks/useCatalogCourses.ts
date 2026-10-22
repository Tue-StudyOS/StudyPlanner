import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth'
import { resolveCourseEcts } from '../utils/courseEcts.ts'
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
  return `catalog:courses:v4:${search}::${limit}::${periodId ?? ''}`
}

export function useCatalogCourses(
  search: string,
  limit: number = 200,
  periodId?: string,
  enabled: boolean = true,
  studyProgramCode?: string | null,
): {
  courses: Course[]
  isLoading: boolean
  error: string | null
  refreshWarning: string | null
} {
  const { user } = useAuth()
  const programCode = studyProgramCode === undefined ? user?.profile.studyProgramCode : studyProgramCode
  const cacheKey = enabled
    ? buildCacheKey(search, limit, periodId)
    : 'catalog:courses:disabled'
  const [state, setState] = useState<CatalogQueryState>(() => {
    const cached = enabled ? readSessionCache<Course[]>(cacheKey) : null
    return {
      cacheKey,
      courses: cached ?? [],
      isLoading: enabled && !cached,
      error: null,
      refreshWarning: null,
    }
  })

  if (state.cacheKey !== cacheKey) {
    const cached = enabled ? readSessionCache<Course[]>(cacheKey) : null
    setState({
      cacheKey,
      courses: cached ?? (enabled ? state.courses : []),
      isLoading: enabled && !cached,
      error: null,
      refreshWarning: null,
    })
  }

  useEffect(() => {
    if (!enabled || readSessionCache<Course[]>(cacheKey)) {
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
  }, [cacheKey, enabled, limit, periodId, search])

  const courses = useMemo(() => state.courses.map((course) => resolveCourseEcts(course, programCode)), [state.courses, programCode])
  return {
    courses,
    isLoading: state.isLoading,
    error: state.error,
    refreshWarning: state.refreshWarning,
  }
}

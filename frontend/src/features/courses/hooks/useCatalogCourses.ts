import { useEffect, useState } from 'react'
import { fetchCatalogCourses } from '../api'
import type { Course } from '../types'

// Catalog responses change rarely, so cache them per query for the session.
// This makes returning to the catalog (or the transcript page, which loads the
// same default query) instant instead of refetching on every mount.
const CATALOG_CACHE = new Map<string, Course[]>()
const CATALOG_CACHE_MAX_ENTRIES = 30
// Typing in the search box should not fire one request per keystroke.
const SEARCH_DEBOUNCE_MS = 250

interface CatalogQueryState {
  cacheKey: string
  courses: Course[]
  isLoading: boolean
  error: string | null
}

function buildCacheKey(search: string, limit: number, periodId?: string): string {
  return `${search}::${limit}::${periodId ?? ''}`
}

function storeInCache(cacheKey: string, courses: Course[]): void {
  if (CATALOG_CACHE.size >= CATALOG_CACHE_MAX_ENTRIES) {
    const oldestKey = CATALOG_CACHE.keys().next().value
    if (oldestKey !== undefined) {
      CATALOG_CACHE.delete(oldestKey)
    }
  }
  CATALOG_CACHE.set(cacheKey, courses)
}

export function useCatalogCourses(search: string, limit: number = 200, periodId?: string): {
  courses: Course[]
  isLoading: boolean
  error: string | null
} {
  const cacheKey = buildCacheKey(search, limit, periodId)
  const [state, setState] = useState<CatalogQueryState>(() => {
    const cached = CATALOG_CACHE.get(cacheKey)
    return { cacheKey, courses: cached ?? [], isLoading: !cached, error: null }
  })

  // Adjust state during render when the query changes; previous results stay
  // visible while the new query loads, matching the old behavior.
  if (state.cacheKey !== cacheKey) {
    const cached = CATALOG_CACHE.get(cacheKey)
    setState({
      cacheKey,
      courses: cached ?? state.courses,
      isLoading: !cached,
      error: null,
    })
  }

  useEffect(() => {
    if (CATALOG_CACHE.has(cacheKey)) {
      return
    }

    let isActive = true

    async function loadCourses(): Promise<void> {
      try {
        const nextCourses = await fetchCatalogCourses(search, limit, periodId)
        if (!isActive) {
          return
        }
        storeInCache(cacheKey, nextCourses)
        setState((current) =>
          current.cacheKey === cacheKey
            ? { cacheKey, courses: nextCourses, isLoading: false, error: null }
            : current,
        )
      } catch (loadError) {
        if (!isActive) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : 'Failed to load courses.'
        setState((current) =>
          current.cacheKey === cacheKey
            ? { cacheKey, courses: current.courses, isLoading: false, error: message }
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

  return { courses: state.courses, isLoading: state.isLoading, error: state.error }
}

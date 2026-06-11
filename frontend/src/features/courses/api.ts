import { ApiError, fetchJson } from '../../shared/utils/api'
import type { CatalogPeriod, Course } from './types'

interface CatalogCoursesResponse {
  count: number
  courses: Course[]
}

interface CatalogPeriodsResponse {
  count: number
  periods: CatalogPeriod[]
}

// Worker cold starts and flaky connections occasionally fail a single request;
// retry transient failures before surfacing an error to the user.
const RETRY_DELAYS_MS = [600, 1800]

// Requests the deduplicated multi-period catalog instead of one semester slice.
export const ALL_CATALOG_PERIODS = 'all'

function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500
  }
  return true
}

export async function fetchCatalogCourses(
  search?: string,
  limit: number = 200,
  periodId?: string,
): Promise<Course[]> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (search?.trim()) {
    query.set('q', search.trim())
  }
  if (periodId?.trim()) {
    query.set('period', periodId.trim())
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchJson<CatalogCoursesResponse>(`/api/catalog/courses?${query.toString()}`)
      return response.courses
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length || !isTransientError(error)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }
}

export async function fetchCatalogPeriods(): Promise<CatalogPeriod[]> {
  const response = await fetchJson<CatalogPeriodsResponse>('/api/catalog/periods')
  return response.periods
}

export async function fetchCatalogCourseDetail(courseId: string): Promise<Course> {
  return await fetchJson<Course>(`/api/catalog/courses/${courseId}`)
}

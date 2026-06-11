import { fetchJson } from '../../shared/utils/api'
import type { CatalogPeriod, Course } from './types'

interface CatalogCoursesResponse {
  count: number
  courses: Course[]
}

interface CatalogPeriodsResponse {
  count: number
  periods: CatalogPeriod[]
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

  const response = await fetchJson<CatalogCoursesResponse>(`/api/catalog/courses?${query.toString()}`)
  return response.courses
}

export async function fetchCatalogPeriods(): Promise<CatalogPeriod[]> {
  const response = await fetchJson<CatalogPeriodsResponse>('/api/catalog/periods')
  return response.periods
}

export async function fetchCatalogCourseDetail(courseId: string): Promise<Course> {
  return await fetchJson<Course>(`/api/catalog/courses/${courseId}`)
}

import { fetchJson } from '../../shared/utils/api'
import type { Course } from './types'

interface CatalogCoursesResponse {
  count: number
  courses: Course[]
}

export async function fetchCatalogCourses(search?: string): Promise<Course[]> {
  const query = new URLSearchParams({ limit: '120' })
  if (search?.trim()) {
    query.set('q', search.trim())
  }

  const response = await fetchJson<CatalogCoursesResponse>(`/api/catalog/courses?${query.toString()}`)
  return response.courses
}

export async function fetchCatalogCourseDetail(courseId: string): Promise<Course> {
  return await fetchJson<Course>(`/api/catalog/courses/${courseId}`)
}

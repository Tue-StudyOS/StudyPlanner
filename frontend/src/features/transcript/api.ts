import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type { CompletedCourse } from '../courses'

interface CompletedCoursesResponse {
  completedCourses: CompletedCourse[]
  count: number
}

export async function fetchCompletedCourses(token: string): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return response.completedCourses
}

export async function saveCompletedCourses(
  token: string,
  completedCourses: CompletedCourse[],
): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify({ completedCourses }),
  })
  return response.completedCourses
}

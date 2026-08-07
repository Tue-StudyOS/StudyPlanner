import { createCsrfHeaders, fetchJson } from '../../shared/utils/api'
import type { CourseReviewsResponse } from './types.ts'
import type { CourseReviewPayload } from './utils/reviewValidation.ts'

export async function fetchCourseReviews(courseId: string): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/catalog/courses/${encodeURIComponent(courseId)}/reviews`,
  )
}

export async function saveCourseReview(
  csrfToken: string,
  courseId: string,
  payload: CourseReviewPayload,
): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/me/course-reviews/${encodeURIComponent(courseId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createCsrfHeaders(csrfToken),
      },
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteCourseReview(
  csrfToken: string,
  courseId: string,
): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/me/course-reviews/${encodeURIComponent(courseId)}`,
    {
      method: 'DELETE',
      headers: createCsrfHeaders(csrfToken),
    },
  )
}

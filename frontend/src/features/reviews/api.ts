import { createCsrfHeaders, fetchJson } from '../../shared/utils/api'
import type { CourseReviewsResponse } from './types.ts'
import { readOrCreateGuestReviewToken } from './utils/guestReviewToken.ts'
import type { CourseReviewPayload } from './utils/reviewValidation.ts'

function reviewHeaders(csrfToken: string | null): HeadersInit {
  const guestToken = readOrCreateGuestReviewToken()
  return {
    ...(guestToken ? { 'X-Guest-Review-Token': guestToken } : {}),
    ...createCsrfHeaders(csrfToken),
  }
}

export async function fetchCourseReviews(courseId: string): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/catalog/courses/${encodeURIComponent(courseId)}/reviews`,
    { headers: reviewHeaders(null) },
  )
}

export async function saveCourseReview(
  csrfToken: string | null,
  courseId: string,
  payload: CourseReviewPayload,
): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/catalog/courses/${encodeURIComponent(courseId)}/reviews`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...reviewHeaders(csrfToken),
      },
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteCourseReview(
  csrfToken: string | null,
  courseId: string,
): Promise<CourseReviewsResponse> {
  return fetchJson<CourseReviewsResponse>(
    `/api/catalog/courses/${encodeURIComponent(courseId)}/reviews`,
    {
      method: 'DELETE',
      headers: reviewHeaders(csrfToken),
    },
  )
}

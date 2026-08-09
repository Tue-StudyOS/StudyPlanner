import { createCsrfHeaders, fetchJson } from '../../shared/utils/api'
import type {
  CourseReviewsResponse,
  ReviewNoticePayload,
  ReviewNoticeReceipt,
} from './types.ts'
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

export async function submitCourseReviewNotice(
  payload: ReviewNoticePayload,
): Promise<ReviewNoticeReceipt> {
  return fetchJson<ReviewNoticeReceipt>('/api/course-review-notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

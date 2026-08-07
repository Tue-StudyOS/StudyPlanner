import { useCallback, useEffect, useState } from 'react'
import { toUserFacingApiMessage } from '../../../shared/utils/userFacingApiError.ts'
import { useAuth } from '../../auth'
import { deleteCourseReview, fetchCourseReviews, saveCourseReview } from '../api.ts'
import type { CourseReviewsResponse } from '../types.ts'
import type { CourseReviewPayload } from '../utils/reviewValidation.ts'

export interface UseCourseReviewsResult {
  data: CourseReviewsResponse | null
  isLoading: boolean
  loadError: string | null
  isSaving: boolean
  saveError: string | null
  submitReview: (payload: CourseReviewPayload) => Promise<boolean>
  removeReview: () => Promise<boolean>
}

/**
 * Reviews are deliberately not session-cached: the list must reflect the
 * viewer's own submission the moment it lands, and it is one small request.
 */
export function useCourseReviews(courseId: string): UseCourseReviewsResult {
  const { csrfToken } = useAuth()
  const [data, setData] = useState<CourseReviewsResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void (async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await fetchCourseReviews(courseId)
        if (isActive) {
          setData(response)
        }
      } catch (error) {
        if (isActive) {
          setLoadError(toUserFacingApiMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [courseId])

  const runWrite = useCallback(
    async (write: (token: string, id: string) => Promise<CourseReviewsResponse>): Promise<boolean> => {
      if (!csrfToken) {
        setSaveError('Your session may have expired. Please sign in again.')
        return false
      }

      setIsSaving(true)
      setSaveError(null)
      try {
        setData(await write(csrfToken, courseId))
        return true
      } catch (error) {
        setSaveError(toUserFacingApiMessage(error))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [courseId, csrfToken],
  )

  const submitReview = useCallback(
    (payload: CourseReviewPayload) =>
      runWrite((token, id) => saveCourseReview(token, id, payload)),
    [runWrite],
  )

  const removeReview = useCallback(
    () => runWrite((token, id) => deleteCourseReview(token, id)),
    [runWrite],
  )

  return { data, isLoading, loadError, isSaving, saveError, submitReview, removeReview }
}

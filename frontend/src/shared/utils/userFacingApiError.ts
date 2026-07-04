import { ApiError } from './api.ts'

/** Keeps user-facing copy calm; technical detail lives in the request log. */
export function toUserFacingApiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'network_error' || error.status === 0) {
      return 'The service is temporarily unavailable. Please try again shortly.'
    }
    if (error.status >= 500) {
      return 'Something went wrong on our side. Please try again shortly.'
    }
    if (error.status === 401 || error.status === 403) {
      return 'Your session may have expired. Please sign in again.'
    }
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

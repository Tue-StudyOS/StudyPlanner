import { getApiBaseUrl } from './apiBaseUrl.ts'

function createAuthHeaders(token: string | null): HeadersInit {
  if (!token) {
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

const AUTH_TOKEN_KEY = 'studyplanner.auth.token'

export interface ClientErrorReportPayload {
  method: string
  url: string
  status: number
  code?: string
  message: string
  detail?: string
  durationMs?: number
  pagePath?: string
}

function loadAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

/** Fire-and-forget: aggregates failures from all users in D1. */
export function reportClientErrorToServer(payload: ClientErrorReportPayload): void {
  const apiBaseUrl = getApiBaseUrl()
  const normalizedPath = '/api/client-errors'
  const requestUrl = apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath

  const token = loadAuthToken()
  void fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify({
      ...payload,
      pagePath: payload.pagePath ?? window.location.pathname,
    }),
  }).catch(() => {
    // Logging must never break the UI flow.
  })
}

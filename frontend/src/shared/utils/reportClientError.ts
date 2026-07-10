import { getApiBaseUrl } from './apiBaseUrl.ts'

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

/** Fire-and-forget diagnostics; the HttpOnly session cookie is sent by fetch. */
export function reportClientErrorToServer(payload: ClientErrorReportPayload): void {
  const apiBaseUrl = getApiBaseUrl()
  const normalizedPath = '/api/client-errors'
  const requestUrl = apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath

  void fetch(requestUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      pagePath: payload.pagePath ?? window.location.pathname,
    }),
  }).catch(() => {
    // Logging must never break the UI flow.
  })
}

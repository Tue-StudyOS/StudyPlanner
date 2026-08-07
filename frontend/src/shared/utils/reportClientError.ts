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

/**
 * A failing backend used to generate the traffic that kept it failing: 24 of the
 * 43 errors captured during the August 2026 load test were these reports, each
 * one provoked by a failure of the same wedged Worker. Capping them per page
 * load stops a partial outage from feeding itself.
 */
const MAX_REPORTS_PER_PAGE_LOAD = 10
let reportsSentThisPageLoad = 0

/**
 * Statuses that are ordinary outcomes rather than defects: 401 is every
 * anonymous visitor's session check, and 429 is the rate limiter working. Both
 * arrive in bursts and drown out the reports worth reading.
 */
const UNREPORTED_STATUSES = new Set([401, 429])

/** Exported for tests; page loads reset this naturally. */
export function resetClientErrorReportBudget(): void {
  reportsSentThisPageLoad = 0
}

export function shouldReportClientError(status: number): boolean {
  return !UNREPORTED_STATUSES.has(status) && reportsSentThisPageLoad < MAX_REPORTS_PER_PAGE_LOAD
}

/** Fire-and-forget diagnostics; the HttpOnly session cookie is sent by fetch. */
export function reportClientErrorToServer(payload: ClientErrorReportPayload): void {
  if (!shouldReportClientError(payload.status)) {
    return
  }
  reportsSentThisPageLoad += 1

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
      // This runs inside fetchJson's failure path; throwing here would replace
      // the ApiError callers expect with a ReferenceError.
      pagePath:
        payload.pagePath ?? (typeof window === 'undefined' ? undefined : window.location.pathname),
    }),
  }).catch(() => {
    // Logging must never break the UI flow.
  })
}

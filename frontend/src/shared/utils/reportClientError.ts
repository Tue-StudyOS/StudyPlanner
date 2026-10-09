import { getApiBaseUrl } from './apiBaseUrl.ts'
import { sanitizeDiagnosticFields } from './diagnosticRedaction.ts'

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
const pendingReports: { payload: ClientErrorReportPayload; attempts: number }[] = []
let isFlushing = false

/**
 * Statuses that are ordinary outcomes rather than defects: 401 is every
 * anonymous visitor's session check, and 429 is the rate limiter working. Both
 * arrive in bursts and drown out the reports worth reading.
 */
const UNREPORTED_STATUSES = new Set([401, 429])

/** Exported for tests; page loads reset this naturally. */
export function resetClientErrorReportBudget(): void {
  reportsSentThisPageLoad = 0
  pendingReports.length = 0
}

export function shouldReportClientError(status: number): boolean {
  return !UNREPORTED_STATUSES.has(status) && reportsSentThisPageLoad < MAX_REPORTS_PER_PAGE_LOAD
}

/** Queue bounded, redacted reports; do not discard the evidence just because the API is down. */
export function reportClientErrorToServer(payload: ClientErrorReportPayload): void {
  if (!shouldReportClientError(payload.status)) {
    return
  }
  reportsSentThisPageLoad += 1

  const sanitizedPayload = sanitizeDiagnosticFields({
    ...payload,
    // This runs inside fetchJson's failure path; throwing here would replace
    // the ApiError callers expect with a ReferenceError.
    pagePath:
      payload.pagePath ?? (typeof window === 'undefined' ? undefined : window.location.pathname),
  })

  pendingReports.push({ payload: sanitizedPayload, attempts: 0 })
  void flushClientErrorReports()
}

/** Retry after a real API request succeeds, never on a timer against an unhealthy Worker. */
export async function flushClientErrorReports(): Promise<void> {
  if (isFlushing) return
  isFlushing = true
  try {
    while (pendingReports.length > 0) {
      const report = pendingReports[0]
      report.attempts += 1
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/client-errors`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.payload),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok && (response.status >= 500 || response.status === 429)) {
          if (report.attempts >= 3 && pendingReports[0] === report) pendingReports.shift()
          return
        }
        if (pendingReports[0] === report) pendingReports.shift()
      } catch {
        if (report.attempts >= 3 && pendingReports[0] === report) pendingReports.shift()
        return
      }
    }
  } finally {
    isFlushing = false
  }
}

import { appendApiRequestLog } from './apiRequestLog.ts'
import { getApiBaseUrl } from './apiBaseUrl.ts'
import { flushClientErrorReports, reportClientErrorToServer, type ClientErrorReportPayload } from './reportClientError.ts'
import { createRequestId, describeRequestDiagnostics, extractCloudflareErrorCode } from './requestDiagnostics.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Deployed Pages apps call same-origin /api/*; VITE_API_BASE_URL is localhost-only.
export { getApiBaseUrl } from './apiBaseUrl.ts'

// The body must be consumed exactly once: non-JSON error bodies (e.g. Cloudflare's
// plain-text "error code: 1101" pages) previously triggered a second read via
// response.text() after response.json() failed, which threw "body stream already read".
export function parseApiErrorBody(
  bodyText: string,
  status: number,
): { message: string; code?: string } {
  const fallbackMessage = `Request failed with status ${status}`
  const trimmed = bodyText.trim()
  const cloudflareCode = extractCloudflareErrorCode(bodyText)
  if (cloudflareCode) {
    return { message: fallbackMessage, code: `cloudflare_${cloudflareCode}` }
  }
  if (/^<!doctype|^<html/i.test(trimmed)) {
    return { message: fallbackMessage }
  }
  if (!bodyText) {
    return { message: fallbackMessage }
  }

  try {
    const errorPayload = JSON.parse(bodyText) as unknown
    if (typeof errorPayload === 'object' && errorPayload !== null) {
      const { message, error } = errorPayload as { error?: unknown; message?: unknown }
      return {
        message: typeof message === 'string' && message ? message : fallbackMessage,
        code: typeof error === 'string' ? error : undefined,
      }
    }
  } catch {
    // Not JSON; fall through to the raw body text.
  }

  return { message: bodyText }
}

export function createCsrfHeaders(csrfToken: string | null | undefined): HeadersInit {
  if (!csrfToken) {
    return {}
  }
  return { 'X-CSRF-Token': csrfToken }
}

export function createLegacyBearerHeaders(token: string | null | undefined): HeadersInit {
  if (!token) {
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

const RETRY_SAFE_METHODS = new Set(['GET', 'HEAD'])
const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = 300

/**
 * Retries a request that failed in a way that is safe to repeat. Status 0 is a
 * transport failure and behaves like a 5xx here.
 *
 * **How much this actually helps is unverified, and the original rationale was
 * wrong.** It was written believing a faulting isolate hangs one request and
 * serves the next normally. Measurements since (docs/load-test-2026-08.md) show a
 * keep-alive connection stays pinned to one isolate, and a wedged isolate keeps
 * failing — so a retry on the same connection can land on the same dead isolate.
 * The absorption rate has never been observed during an actual fault.
 *
 * Kept because retrying a safe method is cheap and cannot make things worse, not
 * because it is known to work. Forcing a new connection would be the fix if the
 * pinning behaviour is confirmed.
 *
 * Only methods that are safe to repeat are retried; a POST that timed out may
 * still have been applied server-side.
 */
export function isRetryableFailure(method: string, status: number): boolean {
  return RETRY_SAFE_METHODS.has(method.toUpperCase()) && (status === 0 || status >= 500)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

interface RequestFailure {
  status: number
  code?: string
  message: string
  detail?: string
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const requestUrl = `${apiBaseUrl}${normalizedPath}`
  const method = init?.method ?? 'GET'
  let recoveredFailure: ClientErrorReportPayload | null = null

  for (let attempt = 1; ; attempt += 1) {
    const startedAt = Date.now()
    const requestId = createRequestId()
    const headers = new Headers(init?.headers)
    headers.set('X-Request-ID', requestId)
    let response: Response | null = null
    let failure: RequestFailure | null = null
    let result: T | undefined
    let bodyText = ''

    try {
      response = await fetch(requestUrl, {
        ...init,
        headers,
        credentials: init?.credentials ?? 'include',
      })
    } catch {
      failure = {
        status: 0,
        code: 'network_error',
        message: 'Network request failed',
      }
    }

    if (response) {
      try {
        bodyText = await response.text()
        if (!response.ok) {
          const { message, code } = parseApiErrorBody(bodyText, response.status)
          failure = { status: response.status, code, message }
        } else if (response.status !== 204) {
          try {
            result = JSON.parse(bodyText) as T
          } catch {
            failure = { status: response.status, code: 'invalid_json', message: 'The service returned an invalid response.' }
          }
        }
      } catch {
        failure = { status: 0, code: 'unreadable_response', message: 'The response could not be read.' }
      }
    }

    if (failure) {
      failure.detail = describeRequestDiagnostics(response, requestId, attempt, startedAt, bodyText)
      recoveredFailure ??= { ...failure, method, url: requestUrl, durationMs: Date.now() - startedAt }
      // Every attempt is logged locally — the retries are themselves a signal —
      // but only the final one is reported to the backend.
      appendApiRequestLog({
        timestamp: Date.now(),
        method,
        url: requestUrl,
        status: failure.status,
        code: failure.code,
        message: failure.message,
        detail: failure.detail,
        durationMs: Date.now() - startedAt,
      })

      if (attempt < MAX_ATTEMPTS && isRetryableFailure(method, failure.status)) {
        await delay(RETRY_BACKOFF_MS * attempt)
        continue
      }

      reportClientErrorToServer({
        method,
        url: requestUrl,
        status: failure.status,
        code: failure.code,
        message: failure.message,
        detail: failure.detail,
        durationMs: Date.now() - startedAt,
      })
      throw new ApiError(
        failure.status === 0
          ? 'The service is temporarily unavailable. Please try again shortly.'
          : failure.message,
        failure.status,
        failure.code,
      )
    }

    const okResponse = response as Response
    if (recoveredFailure) {
      reportClientErrorToServer({
        ...recoveredFailure,
        detail: `${recoveredFailure.detail}\nRecovered on attempt: ${attempt}`,
      })
    }
    void flushClientErrorReports()
    appendApiRequestLog({
      timestamp: Date.now(),
      method,
      url: requestUrl,
      status: okResponse.status,
      message: 'OK',
      detail: describeRequestDiagnostics(okResponse, requestId, attempt, startedAt),
      durationMs: Date.now() - startedAt,
    })
    return result as T
  }
}

import { appendApiRequestLog } from './apiRequestLog.ts'
import { getApiBaseUrl } from './apiBaseUrl.ts'
import { reportClientErrorToServer } from './reportClientError.ts'

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

// Deployed Pages apps can call the backend Worker directly via VITE_API_BASE_URL.
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
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return { message: fallbackMessage }
  }
  if (!bodyText) {
    return { message: fallbackMessage }
  }

  try {
    const errorPayload = JSON.parse(bodyText) as unknown
    if (typeof errorPayload === 'object' && errorPayload !== null) {
      const { message, error } = errorPayload as { error?: string; message?: string }
      return { message: message || fallbackMessage, code: error }
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

  for (let attempt = 1; ; attempt += 1) {
    const startedAt = Date.now()
    let response: Response | null = null
    let failure: RequestFailure | null = null

    try {
      response = await fetch(requestUrl, {
        ...init,
        credentials: init?.credentials ?? 'include',
      })
    } catch (cause) {
      failure = {
        status: 0,
        code: 'network_error',
        message: 'Network request failed',
        detail: cause instanceof Error ? cause.message : String(cause),
      }
    }

    if (response && !response.ok) {
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {
        // Ignore unreadable bodies; the status-based fallback message is used.
      }
      const { message, code } = parseApiErrorBody(bodyText, response.status)
      failure = { status: response.status, code, message, detail: bodyText || undefined }
    }

    if (failure) {
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
    appendApiRequestLog({
      timestamp: Date.now(),
      method,
      url: requestUrl,
      status: okResponse.status,
      message: 'OK',
      durationMs: Date.now() - startedAt,
    })

    if (okResponse.status === 204) {
      return undefined as T
    }

    const bodyText = await okResponse.text()
    try {
      return JSON.parse(bodyText) as T
    } catch {
      throw new ApiError(
        'Something went wrong on our side. Please try again shortly.',
        okResponse.status,
        'invalid_json',
      )
    }
  }
}

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

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const requestUrl = `${apiBaseUrl}${normalizedPath}`
  const method = init?.method ?? 'GET'
  const startedAt = Date.now()
  let response: Response

  try {
    response = await fetch(requestUrl, {
      ...init,
      credentials: init?.credentials ?? 'include',
    })
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    appendApiRequestLog({
      timestamp: Date.now(),
      method,
      url: requestUrl,
      status: 0,
      code: 'network_error',
      message: 'Network request failed',
      detail,
      durationMs: Date.now() - startedAt,
    })
    reportClientErrorToServer({
      method,
      url: requestUrl,
      status: 0,
      code: 'network_error',
      message: 'Network request failed',
      detail,
      durationMs: Date.now() - startedAt,
    })
    throw new ApiError(
      'The service is temporarily unavailable. Please try again shortly.',
      0,
      'network_error',
    )
  }

  if (!response.ok) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {
      // Ignore unreadable bodies; the status-based fallback message is used.
    }

    const { message, code } = parseApiErrorBody(bodyText, response.status)
    appendApiRequestLog({
      timestamp: Date.now(),
      method,
      url: requestUrl,
      status: response.status,
      code,
      message,
      detail: bodyText || undefined,
      durationMs: Date.now() - startedAt,
    })
    reportClientErrorToServer({
      method,
      url: requestUrl,
      status: response.status,
      code,
      message,
      detail: bodyText || undefined,
      durationMs: Date.now() - startedAt,
    })
    throw new ApiError(message, response.status, code)
  }

  appendApiRequestLog({
    timestamp: Date.now(),
    method,
    url: requestUrl,
    status: response.status,
    message: 'OK',
    durationMs: Date.now() - startedAt,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const bodyText = await response.text()
  try {
    return JSON.parse(bodyText) as T
  } catch {
    throw new ApiError(
      'Something went wrong on our side. Please try again shortly.',
      response.status,
      'invalid_json',
    )
  }
}

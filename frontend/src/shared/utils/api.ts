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

// Direct workers.dev ingress: the Pages /api service-binding proxy crashes the
// Python API worker (Cloudflare error 1101). See workerd#6624.
const PRODUCTION_API_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'
const PRODUCTION_PAGES_HOST = 'studyplaner.pages.dev'
const PRODUCTION_PAGES_PREVIEW_SUFFIX = '.studyplaner.pages.dev'

function isProductionPagesHost(hostname: string): boolean {
  return hostname === PRODUCTION_PAGES_HOST || hostname.endsWith(PRODUCTION_PAGES_PREVIEW_SUFFIX)
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost') {
      return 'http://localhost:8787'
    }
    if (isProductionPagesHost(hostname)) {
      return PRODUCTION_API_BASE_URL
    }
  }

  return ''
}

// The body must be consumed exactly once: non-JSON error bodies (e.g. Cloudflare's
// plain-text "error code: 1101" pages) previously triggered a second read via
// response.text() after response.json() failed, which threw "body stream already read".
export function parseApiErrorBody(
  bodyText: string,
  status: number,
): { message: string; code?: string } {
  const fallbackMessage = `Request failed with status ${status}`
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

export function createAuthHeaders(token: string | null | undefined): HeadersInit {
  if (!token) {
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const requestUrl = `${apiBaseUrl}${normalizedPath}`
  let response: Response

  try {
    response = await fetch(requestUrl, init)
  } catch {
    throw new ApiError(
      'Could not reach the server. Check your connection and try again.',
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
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

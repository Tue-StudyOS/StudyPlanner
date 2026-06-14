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
  } catch (error) {
    const fallbackMessage = `Network error while requesting ${requestUrl}. The API may be unreachable or blocked by CORS.`
    throw new ApiError(
      error instanceof Error && error.message ? `${fallbackMessage} ${error.message}` : fallbackMessage,
      0,
      'network_error',
    )
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    let code: string | undefined

    try {
      const errorPayload = (await response.json()) as { error?: string; message?: string }
      message = errorPayload.message || message
      code = errorPayload.error
    } catch {
      const errorText = await response.text()
      if (errorText) {
        message = errorText
      }
    }

    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

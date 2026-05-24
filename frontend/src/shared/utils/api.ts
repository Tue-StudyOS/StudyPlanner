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

export function getApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787'
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
  let response: Response
  
  try {
    response = await fetch(`${apiBaseUrl}${normalizedPath}`, init)
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Network error occurred. The server may be unreachable.', 0, 'network_error')
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

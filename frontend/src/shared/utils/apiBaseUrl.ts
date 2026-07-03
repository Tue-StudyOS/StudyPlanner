const LOCAL_API_BASE_URL = 'http://localhost:8787'

function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Resolves the API origin for browser requests.
 * Deployed Pages builds use same-origin `/api/*` (no CORS). Local dev uses
 * `VITE_API_BASE_URL` when set, otherwise the local Worker.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim()
    return configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : ''
  }

  const hostname = window.location.hostname
  if (!isLocalDevHostname(hostname)) {
    return ''
  }

  const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  return LOCAL_API_BASE_URL
}

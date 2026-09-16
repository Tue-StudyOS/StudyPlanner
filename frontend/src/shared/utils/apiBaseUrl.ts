const LOCAL_API_BASE_URL = 'http://localhost:8787'

function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Resolves the API origin for browser requests.
 *
 * Deployed hosts always use same-origin `/api/*` (empty base URL). The session
 * cookie is HttpOnly on the API host; Safari/iOS treats a `workers.dev` cookie
 * as third-party when the app is on `pages.dev` and drops it, so personal-data
 * calls 401 while login JSON still paints a signed-in UI.
 *
 * `VITE_API_BASE_URL` is only a localhost override so Vite can target a remote
 * Worker during local development.
 */
export function resolveApiBaseUrl(hostname: string | undefined, configuredBaseUrl: string | undefined): string {
  if (hostname && isLocalDevHostname(hostname)) {
    const normalizedConfiguredBaseUrl = configuredBaseUrl?.trim()
    if (normalizedConfiguredBaseUrl) {
      return normalizedConfiguredBaseUrl.replace(/\/$/, '')
    }
    return LOCAL_API_BASE_URL
  }

  return ''
}

export function getApiBaseUrl(): string {
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  return resolveApiBaseUrl(hostname, import.meta.env?.VITE_API_BASE_URL)
}

const LOCAL_API_BASE_URL = 'http://localhost:8787'

function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Resolves the API origin for browser requests.
 * A configured base URL wins for deployed builds so the browser can call the
 * backend Worker directly. Local dev falls back to the local Worker.
 */
export function resolveApiBaseUrl(hostname: string | undefined, configuredBaseUrl: string | undefined): string {
  const normalizedConfiguredBaseUrl = configuredBaseUrl?.trim()
  if (normalizedConfiguredBaseUrl) {
    return normalizedConfiguredBaseUrl.replace(/\/$/, '')
  }

  if (!hostname || !isLocalDevHostname(hostname)) {
    return ''
  }

  return LOCAL_API_BASE_URL
}

export function getApiBaseUrl(): string {
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  return resolveApiBaseUrl(hostname, import.meta.env?.VITE_API_BASE_URL)
}

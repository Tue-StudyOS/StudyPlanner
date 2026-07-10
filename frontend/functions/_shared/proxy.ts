export interface ServiceBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>
}

export interface GatewayEnv {
  STUDYPLANNER_API?: ServiceBinding
  STUDYPLANNER_MCP?: ServiceBinding
  STUDYPLANNER_API_ORIGIN?: string
  STUDYPLANNER_MCP_ORIGIN?: string
}

export interface GatewayContext {
  request: Request
  env: GatewayEnv
  waitUntil?: (promise: Promise<unknown>) => void
}

export type GatewayTarget = 'api' | 'mcp'

const LOCAL_FALLBACK_ORIGINS: Record<GatewayTarget, string> = {
  api: 'http://localhost:8787',
  mcp: 'http://localhost:8788',
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function getServiceBinding(env: GatewayEnv, target: GatewayTarget): ServiceBinding | undefined {
  return target === 'api' ? env.STUDYPLANNER_API : env.STUDYPLANNER_MCP
}

function getConfiguredFallbackOrigin(env: GatewayEnv, target: GatewayTarget): string | undefined {
  const value = target === 'api' ? env.STUDYPLANNER_API_ORIGIN : env.STUDYPLANNER_MCP_ORIGIN
  const normalized = value?.trim()
  return normalized ? trimTrailingSlash(normalized) : undefined
}

export function resolveFallbackOrigin(
  requestUrl: string,
  target: GatewayTarget,
  configuredOrigin?: string,
): string | undefined {
  const normalizedConfiguredOrigin = configuredOrigin?.trim()
  if (normalizedConfiguredOrigin) {
    return trimTrailingSlash(normalizedConfiguredOrigin)
  }

  const url = new URL(requestUrl)
  return isLocalHostname(url.hostname) ? LOCAL_FALLBACK_ORIGINS[target] : undefined
}

export function buildUpstreamUrl(requestUrl: string, upstreamOrigin: string): string {
  const url = new URL(requestUrl)
  const originUrl = new URL(upstreamOrigin)
  url.protocol = originUrl.protocol
  url.host = originUrl.host
  return url.toString()
}

export function isPublicCatalogRequest(request: Request, target: GatewayTarget): boolean {
  return target === 'api'
    && request.method === 'GET'
    && new URL(request.url).pathname.startsWith('/api/catalog/')
    && !request.headers.has('Authorization')
}

function getDefaultCache(): Cache | null {
  const cacheStorage = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined
  return cacheStorage?.default ?? null
}

function createGatewayErrorResponse(target: GatewayTarget): Response {
  return new Response(
    JSON.stringify({
      error: 'gateway_not_configured',
      message: `StudyPlanner ${target.toUpperCase()} gateway binding is not configured.`,
    }),
    {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

export async function proxyToGatewayTarget(context: GatewayContext, target: GatewayTarget): Promise<Response> {
  const cache = isPublicCatalogRequest(context.request, target) ? getDefaultCache() : null
  const cachedResponse = await cache?.match(context.request)
  if (cachedResponse) {
    return cachedResponse
  }

  const fallbackOrigin = resolveFallbackOrigin(
    context.request.url,
    target,
    getConfiguredFallbackOrigin(context.env, target),
  )
  const binding = getServiceBinding(context.env, target)
  const response = fallbackOrigin
    ? await fetch(new Request(buildUpstreamUrl(context.request.url, fallbackOrigin), context.request))
    : binding
      // Preserve the public Pages URL for the bound worker. The AI facade uses
      // the request origin to build public OpenAPI links, so do not rewrite it.
      ? await binding.fetch(context.request)
      : createGatewayErrorResponse(target)

  if (cache && response.ok) {
    const cacheWrite = cache.put(context.request, response.clone())
    if (context.waitUntil) {
      context.waitUntil(cacheWrite)
    } else {
      await cacheWrite
    }
  }
  return response
}

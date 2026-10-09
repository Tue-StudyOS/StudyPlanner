import { normalizeDiagnosticPath } from '../../src/shared/utils/diagnosticRedaction.ts'
import { createRequestId, readDiagnosticHeader, summarizeGatewayFailure } from '../../src/shared/utils/requestDiagnostics.ts'

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
        'x-error-source': 'gateway',
      },
    },
  )
}

function withDiagnosticHeaders(response: Response, requestId: string, cacheStatus: string): Response {
  const result = new Response(response.body, response)
  result.headers.set('x-request-id', requestId)
  result.headers.set('x-gateway-cache', cacheStatus)
  const upstreamRay = readDiagnosticHeader(response.headers, 'cf-ray')
  if (upstreamRay) result.headers.set('x-upstream-cf-ray', upstreamRay)
  // Let the Pages edge attach its own Ray rather than forwarding an origin Ray.
  result.headers.delete('cf-ray')
  if (cacheStatus === 'hit') {
    // Cached bytes did not invoke the backend for this request ID.
    for (const name of ['x-isolate-id', 'x-isolate-seq', 'x-isolate-age-ms', 'x-worker-version', 'x-upstream-cf-ray']) {
      result.headers.delete(name)
    }
  }
  if (response.status >= 500 && !result.headers.has('x-error-source')) {
    result.headers.set('x-error-source', 'upstream')
  }
  return result
}

export async function proxyToGatewayTarget(context: GatewayContext, target: GatewayTarget): Promise<Response> {
  const requestId = createRequestId(context.request.headers.get('x-request-id'))
  const headers = new Headers(context.request.headers)
  headers.set('x-request-id', requestId)
  const request = new Request(context.request, { headers })
  const cache = isPublicCatalogRequest(request, target) ? getDefaultCache() : null
  const cachedResponse = await cache?.match(request)
  if (cachedResponse) {
    return withDiagnosticHeaders(cachedResponse, requestId, 'hit')
  }

  const fallbackOrigin = resolveFallbackOrigin(
    request.url,
    target,
    getConfiguredFallbackOrigin(context.env, target),
  )
  const binding = getServiceBinding(context.env, target)
  let response: Response
  try {
    response = fallbackOrigin
      ? await fetch(new Request(buildUpstreamUrl(request.url, fallbackOrigin), request))
      // Preserve the public Pages origin for service-bound workers.
      : binding ? await binding.fetch(request) : createGatewayErrorResponse(target)
  } catch (error) {
    // Python can fail before its entrypoint is reached. The JavaScript gateway
    // still returns a correlated error instead of an opaque Pages exception.
    console.error(JSON.stringify({
      event: 'gateway_exception', requestId, target, method: request.method,
      path: normalizeDiagnosticPath(request.url),
      cfRay: readDiagnosticHeader(request.headers, 'cf-ray'),
      exceptionType: error instanceof Error ? error.constructor.name : 'UnknownError',
      fault: summarizeGatewayFailure(error instanceof Error ? error.message : ''),
    }))
    response = new Response(JSON.stringify({
      error: 'gateway_upstream_failure',
      message: 'The backend is temporarily unavailable.',
      requestId,
    }), { status: 502, headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'x-error-source': 'gateway',
    } })
  }

  if (response.status >= 500) {
    console.error(JSON.stringify({
      event: 'gateway_failure', requestId, target, method: request.method,
      path: normalizeDiagnosticPath(request.url), status: response.status,
      errorSource: response.headers.get('x-error-source') ?? 'upstream',
      upstreamRay: readDiagnosticHeader(response.headers, 'cf-ray'),
      workerVersion: readDiagnosticHeader(response.headers, 'x-worker-version'),
      isolateId: readDiagnosticHeader(response.headers, 'x-isolate-id'),
    }))
  }
  if (cache && response.ok) {
    const cacheWrite = cache.put(request, response.clone())
    if (context.waitUntil) {
      context.waitUntil(cacheWrite)
    } else {
      await cacheWrite
    }
  }
  return withDiagnosticHeaders(response, requestId, cache ? 'miss' : 'bypass')
}

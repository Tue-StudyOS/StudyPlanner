export function createRequestId(value?: string | null): string {
  return value && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : crypto.randomUUID()
}

export function readDiagnosticHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)
  return value && /^[A-Za-z0-9_.:/;= -]{1,160}$/.test(value) ? value : undefined
}

export function extractCloudflareErrorCode(body: string): string | undefined {
  // Keep HTML/private response bodies out of diagnostics; retain only the known
  // runtime error number (1101 exception, 1102 resource limit, 1019 loop, etc.).
  return body.slice(0, 16000).match(/(?:error(?:\s+code)?\s*:?\s*|error-code[^>]*>\s*)(1\d{3})\b/i)?.[1]
}

export function summarizeGatewayFailure(message: string): string {
  if (/exceeded.*cpu|cpu.*limit/i.test(message)) return 'cpu_limit'
  if (/memory|resource limit/i.test(message)) return 'resource_limit'
  if (/gil|pyproxy/i.test(message)) return 'python_gil_fault'
  if (/snapshot/i.test(message)) return 'python_snapshot_fault'
  if (/had hung|code.*hung/i.test(message)) return 'worker_hung'
  if (/network|fetch failed|failed to fetch|dns|tls/i.test(message)) return 'upstream_transport'
  return 'unknown_upstream_exception'
}

export function describeRequestDiagnostics(
  response: Response | null,
  requestId: string,
  attempt: number,
  startedAt: number,
  body = '',
): string {
  const headers = response?.headers
  const fields: Record<string, string | number | undefined> = {
    'Request ID': headers ? readDiagnosticHeader(headers, 'x-request-id') ?? requestId : requestId,
    'Attempt': attempt,
    'Started at (UTC)': new Date(startedAt).toISOString(),
    'Cloudflare Ray': headers && readDiagnosticHeader(headers, 'cf-ray'),
    'Upstream Ray': headers && readDiagnosticHeader(headers, 'x-upstream-cf-ray'),
    'Error source': headers && readDiagnosticHeader(headers, 'x-error-source'),
    'Worker version': headers && readDiagnosticHeader(headers, 'x-worker-version'),
    'Isolate ID': headers && readDiagnosticHeader(headers, 'x-isolate-id'),
    'Isolate sequence': headers && readDiagnosticHeader(headers, 'x-isolate-seq'),
    'Isolate age (ms)': headers && readDiagnosticHeader(headers, 'x-isolate-age-ms'),
    'Gateway cache': headers && readDiagnosticHeader(headers, 'x-gateway-cache'),
    'Content type': headers && readDiagnosticHeader(headers, 'content-type'),
    'Cloudflare error': extractCloudflareErrorCode(body),
  }
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

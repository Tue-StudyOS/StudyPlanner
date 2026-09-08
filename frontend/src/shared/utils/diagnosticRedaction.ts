const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const HEADER_PATTERN = /\b(cookie|set-cookie|authorization)\s*[:=]\s*[^\r\n]+/gi
const SECRET_PATTERN = /\b(password|passwd|token|secret|csrf)\s*[:=]\s*[^\s,;]+/gi
const ACADEMIC_DATA_PATTERN = /\b(transcript(?:\s+text)?|zeugnis|grade|note)\s*[:=]\s*[^\r\n,;]+/gi
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#]+)\?[^\s#]*/gi

export function normalizeDiagnosticPath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return '/'
  }

  try {
    const parsed = new URL(trimmed, 'https://studyplanner.invalid')
    return parsed.pathname || '/'
  } catch {
    const path = trimmed.split('#', 1)[0].split('?', 1)[0]
    return path.startsWith('/') ? path : `/${path}`
  }
}

export function redactDiagnosticText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return value
    .replace(URL_QUERY_PATTERN, '$1?[redacted-query]')
    .replace(BEARER_PATTERN, 'Bearer [redacted-token]')
    .replace(HEADER_PATTERN, '$1: [redacted]')
    .replace(SECRET_PATTERN, '$1: [redacted]')
    .replace(ACADEMIC_DATA_PATTERN, '$1: [redacted-academic-data]')
    .replace(EMAIL_PATTERN, '[redacted-email]')
}

export interface DiagnosticFields {
  url: string
  message: string
  detail?: string
  pagePath?: string
}

export function sanitizeDiagnosticFields<T extends DiagnosticFields>(fields: T): T {
  return {
    ...fields,
    url: normalizeDiagnosticPath(fields.url),
    message: redactDiagnosticText(fields.message) ?? '',
    detail: redactDiagnosticText(fields.detail),
    pagePath: fields.pagePath === undefined ? undefined : normalizeDiagnosticPath(fields.pagePath),
  }
}

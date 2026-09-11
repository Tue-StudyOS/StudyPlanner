import { sanitizeDiagnosticFields } from './diagnosticRedaction.ts'

export interface ApiRequestLogEntry {
  id: string
  timestamp: number
  method: string
  url: string
  status: number
  code?: string
  message: string
  detail?: string
  durationMs?: number
}

const MAX_ENTRIES = 80

// Diagnostics are useful only during the current page session.
let entries: ApiRequestLogEntry[] = []

export function appendApiRequestLog(
  entry: Omit<ApiRequestLogEntry, 'id'>,
): void {
  const nextEntry: ApiRequestLogEntry = {
    ...sanitizeDiagnosticFields(entry),
    id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  }
  entries = [nextEntry, ...entries].slice(0, MAX_ENTRIES)
}

export function readApiRequestLog(): ApiRequestLogEntry[] {
  return entries.map((entry) => ({ ...entry }))
}

export function clearApiRequestLog(): void {
  entries = []
}

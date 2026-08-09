import { BROWSER_STORAGE_KEYS } from './browserStorageRegistry.ts'

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

function canUseStorage(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return typeof window.sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

function readRawEntries(): ApiRequestLogEntry[] {
  if (!canUseStorage()) {
    return []
  }
  try {
    const raw = window.sessionStorage.getItem(BROWSER_STORAGE_KEYS.apiRequestLog)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ApiRequestLogEntry[]) : []
  } catch {
    return []
  }
}

function writeRawEntries(entries: ApiRequestLogEntry[]): void {
  if (!canUseStorage()) {
    return
  }
  try {
    window.sessionStorage.setItem(BROWSER_STORAGE_KEYS.apiRequestLog, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // Storage full or unavailable — drop logging rather than breaking requests.
  }
}

export function appendApiRequestLog(
  entry: Omit<ApiRequestLogEntry, 'id'>,
): void {
  const nextEntry: ApiRequestLogEntry = {
    ...entry,
    id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  }
  writeRawEntries([nextEntry, ...readRawEntries()].slice(0, MAX_ENTRIES))
}

export function readApiRequestLog(): ApiRequestLogEntry[] {
  return readRawEntries()
}

export function clearApiRequestLog(): void {
  if (!canUseStorage()) {
    return
  }
  try {
    window.sessionStorage.removeItem(BROWSER_STORAGE_KEYS.apiRequestLog)
  } catch {
    // Diagnostics are optional and storage can be blocked by the browser.
  }
}

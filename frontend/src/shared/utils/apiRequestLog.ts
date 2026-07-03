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

const STORAGE_KEY = 'studyplanner:api-request-log'
const MAX_ENTRIES = 80

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

function readRawEntries(): ApiRequestLogEntry[] {
  if (!canUseStorage()) {
    return []
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
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
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
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
  window.sessionStorage.removeItem(STORAGE_KEY)
}

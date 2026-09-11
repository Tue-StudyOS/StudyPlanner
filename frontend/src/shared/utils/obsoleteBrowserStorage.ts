import { BROWSER_STORAGE_KEYS, SESSION_CACHE_STORAGE_PREFIX } from './browserStorageRegistry.ts'

export function clearObsoleteBrowserStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(BROWSER_STORAGE_KEYS.semesterTabBadge)
  } catch {
    // A blocked store must not prevent startup or logout.
  }
  try {
    window.sessionStorage.removeItem(BROWSER_STORAGE_KEYS.apiRequestLog)
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(`${SESSION_CACHE_STORAGE_PREFIX}.`)) {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Cleanup can be retried on the next load if browser storage is unavailable.
  }
}

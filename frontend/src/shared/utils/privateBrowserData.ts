import { clearApiRequestLog } from './apiRequestLog.ts'
import {
  buildTranscriptImportStorageKey,
} from './browserStorageRegistry.ts'
import { clearSessionCacheForUser } from './sessionCache.ts'

export function clearPrivateBrowserData(username: string): void {
  clearSessionCacheForUser(username)
  clearApiRequestLog()

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(buildTranscriptImportStorageKey(username))
  } catch {
    // Logout must still complete when storage is blocked or unavailable.
  }
}

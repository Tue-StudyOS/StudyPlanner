import { clearApiRequestLog } from './apiRequestLog.ts'
import {
  BROWSER_STORAGE_KEYS,
  buildTranscriptImportStorageKey,
} from './browserStorageRegistry.ts'
import { clearSessionCacheForUser } from './sessionCache.ts'
import { setSemesterBadge } from './semesterBadgeState.ts'

export function clearPrivateBrowserData(username: string): void {
  clearSessionCacheForUser(username)
  clearApiRequestLog()
  setSemesterBadge(false)

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(BROWSER_STORAGE_KEYS.apiRequestLog)
    window.sessionStorage.removeItem(buildTranscriptImportStorageKey(username))
  } catch {
    // Logout must still complete when storage is blocked or unavailable.
  }
}

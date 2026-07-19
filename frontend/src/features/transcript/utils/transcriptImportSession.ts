import type { TranscriptImportCandidate } from '../types.ts'

type TranscriptImportStorage = Pick<Storage, 'setItem' | 'removeItem'>
type TranscriptImportStorageProvider = { readonly sessionStorage: TranscriptImportStorage }

export function persistTranscriptImportCandidates(
  storageProvider: TranscriptImportStorageProvider,
  key: string,
  candidates: TranscriptImportCandidate[],
): boolean {
  let storage: TranscriptImportStorage | null = null
  try {
    storage = storageProvider.sessionStorage
    if (candidates.length > 0) {
      storage.setItem(key, JSON.stringify(candidates))
    } else {
      storage.removeItem(key)
    }
    return true
  } catch {
    // Session restore is optional. Remove stale review data instead of crashing
    // the page when the browser's storage quota is exhausted or unavailable.
    try {
      storage?.removeItem(key)
    } catch {
      // Storage can remain unavailable; the in-memory review still works.
    }
    return false
  }
}

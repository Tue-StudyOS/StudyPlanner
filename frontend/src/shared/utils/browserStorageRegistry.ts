export const BROWSER_STORAGE_KEYS = {
  authCookie: 'studyplanner_session',
  legacyAuthToken: 'studyplanner.auth.token',
  theme: 'theme',
  catalogLayout: 'studyplaner.catalogLayout',
  transcriptCreditedCollapsed: 'studyplaner.transcript.collapse.credited',
  transcriptSavedIssuesCollapsed: 'studyplaner.transcript.collapse.savedIssues',
  transcriptCurrentReviewCollapsed: 'studyplaner.transcript.collapse.currentReview',
  semesterTabBadge: 'studyplanner.semesterTabBadge',
  apiRequestLog: 'studyplanner:api-request-log',
  chunkReloadAt: 'chunk-reload-at',
} as const

export const SESSION_CACHE_STORAGE_PREFIX = 'studyplanner.sessionCache'
export const SESSION_CACHE_SCHEMA_VERSION = 1
export const TRANSCRIPT_IMPORT_STORAGE_PREFIX = 'transcript-import-candidates.v2'

export function buildTranscriptImportStorageKey(username: string | null | undefined): string {
  return `${TRANSCRIPT_IMPORT_STORAGE_PREFIX}.${username ?? 'anonymous'}`
}

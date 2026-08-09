export type BrowserStorageKind = 'cookie' | 'localStorage' | 'sessionStorage'

export interface BrowserStorageRecord {
  id: string
  storage: BrowserStorageKind
  key: string
  owner: string
  purpose: string
  data: string
  duration: string
  necessary: boolean
}

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

export const BROWSER_STORAGE_REGISTRY: readonly BrowserStorageRecord[] = [
  {
    id: 'auth-session',
    storage: 'cookie',
    key: BROWSER_STORAGE_KEYS.authCookie,
    owner: 'Authentication',
    purpose: 'Keep the user signed in and authenticate requested account features.',
    data: 'Signed opaque session token in an HttpOnly cookie.',
    duration: '30 days, or until logout/account deletion.',
    necessary: true,
  },
  {
    id: 'legacy-auth-migration',
    storage: 'localStorage',
    key: BROWSER_STORAGE_KEYS.legacyAuthToken,
    owner: 'Authentication',
    purpose: 'One-time migration from the retired browser-readable bearer token.',
    data: 'Legacy signed session token, if an older deployment left one behind.',
    duration: 'Read once during session restore and immediately removed.',
    necessary: true,
  },
  {
    id: 'theme',
    storage: 'localStorage',
    key: BROWSER_STORAGE_KEYS.theme,
    owner: 'Theme',
    purpose: 'Remember the light/dark theme explicitly selected by the user.',
    data: '`light` or `dark`.',
    duration: 'Until changed or browser storage is cleared.',
    necessary: true,
  },
  {
    id: 'catalog-layout',
    storage: 'localStorage',
    key: BROWSER_STORAGE_KEYS.catalogLayout,
    owner: 'Course catalogue',
    purpose: 'Remember the grid/list layout selected by the user.',
    data: '`grid` or `list`.',
    duration: 'Until changed or browser storage is cleared.',
    necessary: true,
  },
  {
    id: 'transcript-collapse-preferences',
    storage: 'localStorage',
    key: 'studyplaner.transcript.collapse.{credited|savedIssues|currentReview}',
    owner: 'Transcript',
    purpose: 'Remember which transcript sections the user collapsed.',
    data: 'Boolean UI preference.',
    duration: 'Until changed or browser storage is cleared.',
    necessary: true,
  },
  {
    id: 'semester-tab-badge',
    storage: 'localStorage',
    key: BROWSER_STORAGE_KEYS.semesterTabBadge,
    owner: 'Semester planner',
    purpose: 'Show that the user added a course outside the current planner view.',
    data: 'Boolean notification flag.',
    duration: 'Until the user opens the relevant semester view.',
    necessary: true,
  },
  {
    id: 'private-session-cache',
    storage: 'sessionStorage',
    key: `${SESSION_CACHE_STORAGE_PREFIX}.${SESSION_CACHE_SCHEMA_VERSION}.{username}.{feature}`,
    owner: 'Planner and transcript features',
    purpose: 'Avoid duplicate requests while the user uses private account features.',
    data: 'User-scoped progress, completed-course, and semester-plan response data.',
    duration: 'Current tab session, at most 24 hours; cleared on logout/account deletion.',
    necessary: true,
  },
  {
    id: 'transcript-import-candidates',
    storage: 'sessionStorage',
    key: `${TRANSCRIPT_IMPORT_STORAGE_PREFIX}.{username}`,
    owner: 'Transcript import',
    purpose: 'Restore the in-progress transcript review after navigation or reload.',
    data: 'Parsed transcript candidates, grades, semesters, and matching suggestions.',
    duration: 'Current tab session; cleared on logout/account deletion.',
    necessary: true,
  },
  {
    id: 'api-request-log',
    storage: 'sessionStorage',
    key: BROWSER_STORAGE_KEYS.apiRequestLog,
    owner: 'Client diagnostics',
    purpose: 'Let the user inspect recent API failures in the current tab.',
    data: 'Up to 80 request methods, URLs, statuses, codes, messages, and durations.',
    duration: 'Current tab session; cleared on logout/account deletion.',
    necessary: true,
  },
  {
    id: 'chunk-reload-guard',
    storage: 'sessionStorage',
    key: BROWSER_STORAGE_KEYS.chunkReloadAt,
    owner: 'Application shell',
    purpose: 'Prevent a reload loop when a deployment invalidates cached JS chunks.',
    data: 'Timestamp of the last automatic recovery reload.',
    duration: 'Current tab session.',
    necessary: true,
  },
]

import { createCsrfHeaders, fetchJson } from '../../shared/utils/api'
import type { CompletedCourse } from '../courses'
import type {
  BulkCompletedCourseImportItem,
  BulkCompletedCourseImportResult,
  SavedTranscriptIssue,
  TranscriptIssueListPayload,
} from './types'

interface CompletedCoursesResponse {
  completedCourses: CompletedCourse[]
  count: number
}

interface TranscriptIssuesResponse {
  transcriptIssues: SavedTranscriptIssue[]
  count: number
}

interface TranscriptDataClearResponse {
  completedCourses: CompletedCourse[]
  transcriptIssues: SavedTranscriptIssue[]
  completedCourseCount: number
  transcriptIssueCount: number
}

interface BulkCompletedCourseImportResponse extends BulkCompletedCourseImportResult {
  importedCount: number
  skippedDuplicateCount: number
  failedCount: number
}

export async function fetchCompletedCourses(): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses')
  return response.completedCourses
}

export async function saveCompletedCourses(
  csrfToken: string,
  completedCourses: CompletedCourse[],
): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createCsrfHeaders(csrfToken),
    },
    body: JSON.stringify({ completedCourses }),
  })
  return response.completedCourses
}

export async function importCompletedCourses(
  csrfToken: string,
  items: BulkCompletedCourseImportItem[],
): Promise<BulkCompletedCourseImportResult> {
  const response = await fetchJson<BulkCompletedCourseImportResponse>('/api/me/completed-courses/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createCsrfHeaders(csrfToken),
    },
    body: JSON.stringify({ imports: items }),
  })
  return {
    completedCourses: response.completedCourses,
    imported: response.imported,
    skippedDuplicates: response.skippedDuplicates,
    failed: response.failed,
  }
}

export async function fetchTranscriptIssues(): Promise<SavedTranscriptIssue[]> {
  const response = await fetchJson<TranscriptIssuesResponse>('/api/me/transcript-issues')
  return response.transcriptIssues
}

export async function saveTranscriptIssues(
  csrfToken: string,
  payload: TranscriptIssueListPayload,
): Promise<SavedTranscriptIssue[]> {
  const response = await fetchJson<TranscriptIssuesResponse>('/api/me/transcript-issues', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createCsrfHeaders(csrfToken),
    },
    body: JSON.stringify(payload),
  })
  return response.transcriptIssues
}

export async function clearTranscriptData(csrfToken: string): Promise<TranscriptDataClearResponse> {
  return await fetchJson<TranscriptDataClearResponse>('/api/me/transcript-data', {
    method: 'DELETE',
    headers: {
      ...createCsrfHeaders(csrfToken),
    },
  })
}

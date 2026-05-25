import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
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

interface BulkCompletedCourseImportResponse extends BulkCompletedCourseImportResult {
  importedCount: number
  skippedDuplicateCount: number
  failedCount: number
}

export async function fetchCompletedCourses(token: string): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return response.completedCourses
}

export async function saveCompletedCourses(
  token: string,
  completedCourses: CompletedCourse[],
): Promise<CompletedCourse[]> {
  const response = await fetchJson<CompletedCoursesResponse>('/api/me/completed-courses', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify({ completedCourses }),
  })
  return response.completedCourses
}

export async function importCompletedCourses(
  token: string,
  items: BulkCompletedCourseImportItem[],
): Promise<BulkCompletedCourseImportResult> {
  const response = await fetchJson<BulkCompletedCourseImportResponse>('/api/me/completed-courses/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
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

export async function fetchTranscriptIssues(token: string): Promise<SavedTranscriptIssue[]> {
  const response = await fetchJson<TranscriptIssuesResponse>('/api/me/transcript-issues', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return response.transcriptIssues
}

export async function saveTranscriptIssues(
  token: string,
  payload: TranscriptIssueListPayload,
): Promise<SavedTranscriptIssue[]> {
  const response = await fetchJson<TranscriptIssuesResponse>('/api/me/transcript-issues', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  })
  return response.transcriptIssues
}

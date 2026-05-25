import type { CompletedCourse, MasterCat, StudyAreaOption } from '../courses'
import type { RegulationRuleGroup } from '../../shared/utils/regulation'

export interface StudyStats {
  totalEcts: number
  requiredEcts: number
  progress: number
  averageGrade: number | null
}

export type TranscriptImportStatus = 'matched' | 'uncertain' | 'unmatched' | 'invalid'
export type TranscriptImportPhase = 'idle' | 'validating' | 'parsing' | 'parsed' | 'failed' | 'saving'

export interface TranscriptCoursePreview {
  id: string
  number: string
  title: string
  ects: number | null
  masterCats: MasterCat[]
  studyAreaOptions?: StudyAreaOption[]
  regulationAreaCodes?: string[]
}

export interface SavedTranscriptIssue {
  id: string
  candidate: TranscriptImportCandidate
  updatedAtUnix: number
}

export interface ParsedTranscriptEntry {
  id: string
  sourcePage: number
  sourceSection: string | null
  rawText: string
  extractedTitle: string
  titleCandidates: string[]
  extractedGrade: number | null
  extractedEcts: number | null
  extractedSemester: string | null
  defaultMasterCat: MasterCat
  parseIssues: string[]
}

export interface TranscriptImportCandidate {
  id: string
  sourcePage: number
  sourceSection: string | null
  rawText: string
  extractedTitle: string
  extractedEcts: number | null
  titleCandidates: string[]
  title: string
  semester: string
  grade: number | null
  ects: number | null
  masterCat: MasterCat
  studyAreaCode: string | null
  status: TranscriptImportStatus
  statusDetail: string
  parseIssues: string[]
  validationIssues: string[]
  matchOptions: TranscriptCoursePreview[]
  matchedCourse: TranscriptCoursePreview | null
  courseId: string | null
  courseNumber: string | null
  isUserEdited: boolean
}

export interface TranscriptSaveResult {
  saved: boolean
  addedCount: number
  skippedDuplicateCount: number
  errorMessage?: string | null
}

export interface BulkCompletedCourseImportItem {
  id: string
  course: CompletedCourse
}

export interface BulkCompletedCourseImportResultItem {
  id: string
  message: string
}

export interface BulkCompletedCourseImportResult {
  completedCourses: CompletedCourse[]
  imported: BulkCompletedCourseImportResultItem[]
  skippedDuplicates: BulkCompletedCourseImportResultItem[]
  failed: BulkCompletedCourseImportResultItem[]
}

export interface TranscriptIssuesResponse {
  transcriptIssues: SavedTranscriptIssue[]
  count: number
}

export interface TranscriptIssueWritePayload {
  id: string
  candidate: TranscriptImportCandidate
}

export interface TranscriptIssueListPayload {
  transcriptIssues: TranscriptIssueWritePayload[]
}

export interface TranscriptImportBuildContext {
  studyProgramCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
}

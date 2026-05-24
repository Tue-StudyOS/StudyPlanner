import type { MasterCat } from '../courses'

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
}

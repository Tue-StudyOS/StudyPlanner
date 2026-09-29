import type { CompletedCourse, MasterCat } from '../../courses/types.ts'
import { normalizeText } from './buildTranscriptImportCandidates.ts'

export function parsePositiveEcts(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function buildCustomCompletedCourse({
  title,
  ects,
  externalCourseCode,
  semester,
  grade,
  studyAreaCode,
  masterCat,
}: {
  title: string
  ects: number
  externalCourseCode: string | null
  semester: string
  grade: number | null
  studyAreaCode: string | null
  masterCat: MasterCat
}): CompletedCourse {
  const trimmedTitle = title.trim()
  const trimmedCode = externalCourseCode?.trim() || null

  return {
    id: `manual-custom-${normalizeText(trimmedTitle) || 'course'}-${Date.now()}`,
    courseId: null,
    courseNumber: trimmedCode,
    externalCourseCode: trimmedCode,
    title: trimmedTitle,
    ects,
    masterCat,
    studyAreaCode,
    grade,
    semester: semester.trim(),
    source: 'manual',
  }
}

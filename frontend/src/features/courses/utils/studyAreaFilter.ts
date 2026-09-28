import { buildRelevantCourseAreaOptions } from '../../../shared/utils/regulation.ts'
import type { Course } from '../types'

function areaCodesForProgram(
  course: Pick<Course, 'studyAreaOptions'>,
  studyProgramCode: string | null | undefined,
): string[] {
  return buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).map(
    (option) => option.code,
  )
}

export function courseMatchesStudyAreaFilter(
  course: Pick<Course, 'studyAreaOptions'>,
  selectedStudyAreaCodes: string[],
  studyProgramCode: string | null | undefined,
): boolean {
  if (selectedStudyAreaCodes.length === 0) {
    return true
  }

  const codes = new Set(areaCodesForProgram(course, studyProgramCode))
  return selectedStudyAreaCodes.every((code) => codes.has(code))
}

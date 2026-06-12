import { buildRelevantCourseAreaOptions } from '../../../shared/utils/regulation'
import type { Course } from '../types'

export function courseMatchesStudyAreaFilter(
  course: Pick<Course, 'studyAreaOptions'>,
  selectedStudyAreaCodes: string[],
  studyProgramCode: string | null | undefined,
): boolean {
  if (selectedStudyAreaCodes.length === 0) {
    return true
  }
  const relevantAreaCodes = buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).map(
    (option) => option.code,
  )
  return selectedStudyAreaCodes.some((code) => relevantAreaCodes.includes(code))
}

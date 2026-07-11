import type { CompletedCourse } from '../../courses'

export function isTranscriptImportedCourse(
  course: Pick<CompletedCourse, 'id' | 'source'>,
): boolean {
  const normalizedSource = course.source?.trim().toLowerCase() ?? ''
  const normalizedId = course.id.trim().toLowerCase()
  return (
    normalizedSource === 'transcript_import'
    || normalizedSource === 'transcript'
    || normalizedId.startsWith('import-')
    || normalizedId.startsWith('transcript-')
  )
}

export function normalizeCompletedCourseKey(
  course: Pick<CompletedCourse, 'courseId' | 'title' | 'semester' | 'ects' | 'grade'>,
): string {
  if (course.courseId) {
    return `course:${course.courseId}`
  }

  return [
    'manual',
    course.title.trim().toLowerCase(),
    course.semester.trim().toLowerCase(),
    String(course.ects),
    course.grade === null ? 'no-grade' : String(course.grade),
  ].join(':')
}

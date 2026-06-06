import type { CompletedCourse } from '../../courses'

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

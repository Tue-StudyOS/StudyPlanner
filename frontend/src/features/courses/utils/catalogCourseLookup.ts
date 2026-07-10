import type { Course } from '../types.ts'

export function buildCatalogCourseLookup(courses: readonly Course[]): Map<string, Course> {
  const lookup = new Map<string, Course>()
  for (const course of courses) {
    lookup.set(course.id, course)
    for (const sourceCourseId of course.sourceCourseIds ?? []) {
      lookup.set(sourceCourseId, course)
    }
  }
  return lookup
}

export function normalizeCatalogCourseIds(
  courseIds: readonly string[],
  lookup: ReadonlyMap<string, Course>,
): string[] {
  return [...new Set(courseIds.map((courseId) => lookup.get(courseId)?.id ?? courseId))]
}

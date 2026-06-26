import type { CompletedCourse, Course } from '../../courses'

type HistoricalCompletedCourse = Pick<CompletedCourse,
  'courseId' | 'courseNumber' | 'externalCourseCode' | 'semester' | 'studyAreaCode'
>

export interface HistoricalSemesterPlan {
  courses: Course[]
  assignments: Record<string, string>
  matchedCompletedCourseCount: number
}

function normalizeIdentifier(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const normalizedValue = String(value).trim().toLowerCase()
  return normalizedValue || null
}

function addCourseIndexValue(index: Map<string, Course>, value: string | number | null | undefined, course: Course): void {
  const key = normalizeIdentifier(value)
  if (key && !index.has(key)) {
    index.set(key, course)
  }
}

function buildCourseIndex(catalogCourses: Course[]): Map<string, Course> {
  const index = new Map<string, Course>()
  for (const course of catalogCourses) {
    addCourseIndexValue(index, course.id, course)
    addCourseIndexValue(index, course.numericId, course)
    addCourseIndexValue(index, course.number, course)
  }
  return index
}

function findCatalogCourseForCompletedCourse(
  completedCourse: HistoricalCompletedCourse,
  courseIndex: Map<string, Course>,
): Course | null {
  const identifiers = [
    completedCourse.courseId,
    completedCourse.externalCourseCode,
    completedCourse.courseNumber,
  ]
  for (const identifier of identifiers) {
    const key = normalizeIdentifier(identifier)
    if (!key) {
      continue
    }
    const course = courseIndex.get(key)
    if (course) {
      return course
    }
  }
  return null
}

export function buildHistoricalSemesterPlan(
  completedCourses: HistoricalCompletedCourse[],
  catalogCourses: Course[],
  semesterLabel: string,
): HistoricalSemesterPlan {
  const normalizedSemesterLabel = semesterLabel.trim()
  const courseIndex = buildCourseIndex(catalogCourses)
  const seenCourseIds = new Set<string>()
  const courses: Course[] = []
  const assignments: Record<string, string> = {}
  let matchedCompletedCourseCount = 0

  for (const completedCourse of completedCourses) {
    if (completedCourse.semester?.trim() !== normalizedSemesterLabel) {
      continue
    }

    const course = findCatalogCourseForCompletedCourse(completedCourse, courseIndex)
    if (!course) {
      continue
    }

    matchedCompletedCourseCount += 1
    if (completedCourse.studyAreaCode) {
      assignments[course.id] = completedCourse.studyAreaCode
    }
    if (seenCourseIds.has(course.id)) {
      continue
    }
    seenCourseIds.add(course.id)
    courses.push(course)
  }

  return { courses, assignments, matchedCompletedCourseCount }
}

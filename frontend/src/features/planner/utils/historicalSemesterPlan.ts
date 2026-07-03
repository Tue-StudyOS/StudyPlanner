import type { CompletedCourse, Course } from '../../courses'
import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'

type HistoricalCompletedCourse = Pick<
  CompletedCourse,
  'courseId' | 'courseNumber' | 'externalCourseCode' | 'semester' | 'studyAreaCode' | 'title'
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

function normalizeCourseNumber(value: string | null | undefined): string | null {
  const normalized = normalizeIdentifier(value)
  if (!normalized) {
    return null
  }
  return normalized.replace(/\s+/g, '').replace(/-/g, '')
}

function titlesLikelyMatch(completedTitle: string | null | undefined, catalogTitle: string): boolean {
  const normalizedCompletedTitle = cleanCourseTitle(completedTitle ?? '', null).trim().toLowerCase()
  const normalizedCatalogTitle = cleanCourseTitle(catalogTitle, null).trim().toLowerCase()
  if (!normalizedCompletedTitle) {
    return true
  }
  if (normalizedCompletedTitle === normalizedCatalogTitle) {
    return true
  }
  return (
    normalizedCompletedTitle.includes(normalizedCatalogTitle)
    || normalizedCatalogTitle.includes(normalizedCompletedTitle)
  )
}

function buildCourseIndexes(catalogCourses: Course[]): {
  byCatalogId: Map<string, Course>
  byCourseNumber: Map<string, Course>
} {
  const byCatalogId = new Map<string, Course>()
  const byCourseNumber = new Map<string, Course>()

  for (const course of catalogCourses) {
    const catalogId = normalizeIdentifier(course.id)
    if (catalogId && !byCatalogId.has(catalogId)) {
      byCatalogId.set(catalogId, course)
    }

    const courseNumber = normalizeCourseNumber(course.number)
    if (courseNumber) {
      // Prefer the newest representative when the caller passes a deduplicated catalog.
      byCourseNumber.set(courseNumber, course)
    }
  }

  return { byCatalogId, byCourseNumber }
}

function findCatalogCourseForCompletedCourse(
  completedCourse: HistoricalCompletedCourse,
  byCatalogId: Map<string, Course>,
  byCourseNumber: Map<string, Course>,
): Course | null {
  const courseNumber = normalizeCourseNumber(
    completedCourse.courseNumber ?? completedCourse.externalCourseCode,
  )
  if (courseNumber) {
    const byNumberMatch = byCourseNumber.get(courseNumber)
    if (byNumberMatch && titlesLikelyMatch(completedCourse.title, byNumberMatch.title)) {
      return byNumberMatch
    }
  }

  const catalogId = normalizeIdentifier(completedCourse.courseId)
  if (!catalogId) {
    return null
  }

  const byIdMatch = byCatalogId.get(catalogId)
  if (!byIdMatch) {
    return null
  }

  if (courseNumber && normalizeCourseNumber(byIdMatch.number) !== courseNumber) {
    return null
  }

  return titlesLikelyMatch(completedCourse.title, byIdMatch.title) ? byIdMatch : null
}

export function buildHistoricalSemesterPlan(
  completedCourses: HistoricalCompletedCourse[],
  catalogCourses: Course[],
  semesterLabel: string,
): HistoricalSemesterPlan {
  const normalizedSemesterLabel = semesterLabel.trim()
  const { byCatalogId, byCourseNumber } = buildCourseIndexes(catalogCourses)
  const seenCourseIds = new Set<string>()
  const courses: Course[] = []
  const assignments: Record<string, string> = {}
  let matchedCompletedCourseCount = 0

  for (const completedCourse of completedCourses) {
    if (completedCourse.semester?.trim() !== normalizedSemesterLabel) {
      continue
    }

    const course = findCatalogCourseForCompletedCourse(completedCourse, byCatalogId, byCourseNumber)
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

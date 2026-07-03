import type { CatalogPeriod, CompletedCourse, Course } from '../types.ts'
import { findCatalogPeriodForSemesterLabel } from './periods.ts'
import { formatCourseLecturerName } from './lecturerName.ts'

function normalizeCourseNumber(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '')
  return normalized || null
}

function lookupKey(courseKey: string, periodId: string): string {
  return `${courseKey}|${periodId}`
}

/**
 * Builds a period-scoped lecturer lookup from one semester's catalog slice.
 */
export function buildPeriodLecturerLookup(
  periodId: string,
  catalogCourses: Course[],
): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const course of catalogCourses) {
    if (!course.lecturer.trim()) {
      continue
    }
    lookup.set(lookupKey(course.id, periodId), course.lecturer)
    const courseNumber = normalizeCourseNumber(course.number)
    if (courseNumber) {
      lookup.set(lookupKey(courseNumber, periodId), course.lecturer)
    }
  }
  return lookup
}

export function mergePeriodLecturerLookups(lookups: Iterable<Map<string, string>>): Map<string, string> {
  const merged = new Map<string, string>()
  for (const lookup of lookups) {
    for (const [key, value] of lookup) {
      merged.set(key, value)
    }
  }
  return merged
}

export function resolveHistoricalLecturerRaw(
  course: Course,
  completed: CompletedCourse,
  periods: CatalogPeriod[],
  lookup: Map<string, string>,
): string | null {
  const period = findCatalogPeriodForSemesterLabel(periods, completed.semester)
  if (!period) {
    return null
  }

  const byId = lookup.get(lookupKey(course.id, period.periodId))
  if (byId?.trim()) {
    return byId
  }

  const courseNumber = normalizeCourseNumber(
    completed.courseNumber ?? completed.externalCourseCode ?? course.number,
  )
  if (courseNumber) {
    const byNumber = lookup.get(lookupKey(courseNumber, period.periodId))
    if (byNumber?.trim()) {
      return byNumber
    }
  }

  return null
}

/**
 * Shows the lecturer from the semester the course was completed in when known,
 * otherwise falls back to the current catalog row.
 */
export function resolveCourseCardLecturerLabel(
  course: Course,
  completed: CompletedCourse | undefined,
  periods: CatalogPeriod[],
  historicalLookup: Map<string, string>,
): string {
  if (completed) {
    const historicalRaw = resolveHistoricalLecturerRaw(course, completed, periods, historicalLookup)
    if (historicalRaw) {
      return formatCourseLecturerName({ lecturer: historicalRaw })
    }
  }
  return formatCourseLecturerName(course)
}

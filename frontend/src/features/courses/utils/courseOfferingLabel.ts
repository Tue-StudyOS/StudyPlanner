import type { CourseTermType } from '../types'

/**
 * Short tooltip for the catalog season icon — term type only.
 */
export function buildCourseSeasonIconTitle(
  termType: CourseTermType | undefined,
  labels: { summer: string; winter: string; both: string },
): string | undefined {
  switch (termType) {
    case 'summer':
      return labels.summer
    case 'winter':
      return labels.winter
    case 'both':
      return labels.both
    default:
      return undefined
  }
}

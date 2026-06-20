import type { CourseTermType } from '../../courses'

/**
 * A summer-only course in a winter term (or vice versa) is clearly not offered
 * in the planned semester. `both`/`unknown` term types stay plannable because
 * the catalog cannot rule them out, so they are treated as offered.
 */
export function isCourseOfferedInTerm(
  termType: CourseTermType | undefined,
  term: 'SS' | 'WS' | null,
): boolean {
  if (!term || !termType || termType === 'both' || termType === 'unknown') {
    return true
  }
  return term === 'SS' ? termType === 'summer' : termType === 'winter'
}

import type { Course } from '../types.ts'

/** Resolve tree credits for the active program without changing cached API data. */
export function resolveCourseEcts(course: Course, programCode?: string | null): Course {
  if (course.ectsSource !== 'catalog_tree') return course
  const normalizedProgram = programCode?.trim().toUpperCase()
  const publishedOptions = (course.ectsTreeOptions ?? []).filter((option) =>
    Number.isFinite(option.ects) && option.ects > 0,
  )
  const options = publishedOptions.filter((option) => !normalizedProgram || option.programCode === normalizedProgram)
  const candidates = [...new Set(options.map((option) => option.ects))].sort((left, right) => left - right)
  const publishedCandidates = [...new Set(publishedOptions.map((option) => option.ects))].sort((left, right) => left - right)
  return {
    ...course,
    ects: candidates.length === 1 ? candidates[0] : null,
    ectsAlternatives: candidates.length > 0 ? candidates : publishedCandidates,
    ectsProgramMatched: !normalizedProgram || options.length > 0,
  }
}

export function getCourseEctsLabel(course: Course): string | null {
  const format = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (course.ects !== null) return format(course.ects)
  const alternatives = course.ectsAlternatives ?? []
  return alternatives.length > 0 ? alternatives.map(format).join(' / ') : null
}

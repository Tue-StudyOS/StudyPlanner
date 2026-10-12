import type { Course } from '../types.ts'

/** Resolve tree credits for the active program without changing cached API data. */
export function resolveCourseEcts(course: Course, programCode?: string | null): Course {
  if (course.ectsSource !== 'catalog_tree') return course
  const normalizedProgram = programCode?.trim().toUpperCase()
  const options = (course.ectsTreeOptions ?? []).filter((option) =>
    (!normalizedProgram || option.programCode === normalizedProgram)
    && Number.isFinite(option.ects) && option.ects > 0,
  )
  const candidates = [...new Set(options.map((option) => option.ects))].sort((left, right) => left - right)
  return { ...course, ects: candidates.length === 1 ? candidates[0] : null, ectsAlternatives: candidates }
}

export function getCourseEctsLabel(course: Course): string | null {
  const format = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (course.ects !== null) return format(course.ects)
  const alternatives = course.ectsAlternatives ?? []
  return alternatives.length > 1 ? alternatives.map(format).join(' / ') : null
}

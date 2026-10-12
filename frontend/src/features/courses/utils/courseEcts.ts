import type { Course } from '../types.ts'

/** Resolve tree credits for the active program without changing cached API data. */
export function resolveCourseEcts(course: Course, programCode?: string | null): Course {
  if (course.ectsSource !== 'catalog_tree') return course
  const normalizedProgram = programCode?.trim().toUpperCase()
  const options = (course.ectsTreeOptions ?? []).filter((option) =>
    (!normalizedProgram || option.programCode === normalizedProgram)
    && Number.isFinite(option.ects) && option.ects > 0,
  )
  const candidates = [...new Set(options.map((option) => option.ects))]
  return { ...course, ects: candidates.length === 1 ? candidates[0] : null }
}

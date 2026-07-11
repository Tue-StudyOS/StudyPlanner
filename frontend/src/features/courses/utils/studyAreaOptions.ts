import type { StudyAreaOption } from '../types.ts'

function optionSpecificity(option: StudyAreaOption): number {
  return (
    (option.moduleCode ? 4 : 0)
    + (option.moduleTitle ? 2 : 0)
    + (option.ectsCounted !== null ? 1 : 0)
    + (option.optionStatus === 'required' ? 1 : 0)
  )
}

/**
 * ALMA can expose both a module-specific and a generic mapping for the same
 * program area. Show that area once and retain the more informative mapping.
 */
export function dedupeStudyAreaOptions(options: StudyAreaOption[]): StudyAreaOption[] {
  const deduplicated = new Map<string, StudyAreaOption>()

  for (const option of options) {
    if (!option.studyAreaCode) {
      continue
    }
    const programCode = option.programCode?.trim().toUpperCase() ?? ''
    const key = `${programCode}::${option.studyAreaCode.trim().toUpperCase()}`
    const existing = deduplicated.get(key)
    if (!existing || optionSpecificity(option) > optionSpecificity(existing)) {
      deduplicated.set(key, option)
    }
  }

  return [...deduplicated.values()]
}

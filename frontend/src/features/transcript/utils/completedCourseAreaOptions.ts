import type { CompletedCourse } from '../../courses/types.ts'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation.ts'
import {
  buildFlexibleRegulationAreaOptions,
  buildRegulationAreaOptionByCode,
  formatRegulationAreaShortLabel,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation.ts'

export type CompletedCourseAreaSource = Pick<
  CompletedCourse,
  'courseId' | 'studyAreaCode' | 'studyAreaName' | 'availableStudyAreaOptions'
>

function normalizeAreaCode(code: string | null | undefined): string {
  return code?.trim().toUpperCase() ?? ''
}

function fallbackAreaOption(
  code: string,
  name: string | null | undefined,
  groupType: string | null | undefined,
): RegulationAreaOption {
  const label = name?.trim() || code
  return {
    code,
    label,
    shortLabel: formatRegulationAreaShortLabel(code, groupType),
    masterCat: studyAreaCodeToMasterCat(code),
    isFlexible: false,
  }
}

function resolveAreaOption(
  code: string | null | undefined,
  name: string | null | undefined,
  groupType: string | null | undefined,
  ruleGroups: RegulationRuleGroup[],
): RegulationAreaOption | null {
  const normalizedCode = normalizeAreaCode(code)
  if (!normalizedCode) {
    return null
  }
  return buildRegulationAreaOptionByCode(ruleGroups, normalizedCode)
    ?? fallbackAreaOption(normalizedCode, name, groupType)
}

function isCustomCompletedCourse(course: CompletedCourseAreaSource): boolean {
  return course.courseId == null || course.courseId === ''
}

// Credited courses keep the same area choices as the form that created them:
// catalog matches use the server's assignable areas, custom courses can move
// to any flexible area because they have no catalog mapping.
export function buildCompletedCourseAreaOptions(
  course: CompletedCourseAreaSource,
  ruleGroups: RegulationRuleGroup[],
): RegulationAreaOption[] {
  const options: RegulationAreaOption[] = []
  const seenCodes = new Set<string>()

  function push(option: RegulationAreaOption | null): void {
    if (!option) {
      return
    }
    const normalizedCode = normalizeAreaCode(option.code)
    if (!normalizedCode || seenCodes.has(normalizedCode)) {
      return
    }
    seenCodes.add(normalizedCode)
    options.push(option)
  }

  for (const option of course.availableStudyAreaOptions ?? []) {
    push(resolveAreaOption(option.studyAreaCode, option.studyAreaName, option.groupType, ruleGroups))
  }

  if (isCustomCompletedCourse(course)) {
    for (const option of buildFlexibleRegulationAreaOptions(ruleGroups)) {
      push(option)
    }
  }

  push(resolveAreaOption(course.studyAreaCode, course.studyAreaName, null, ruleGroups))
  return options
}

export function completedCourseAreaLabel(
  course: CompletedCourseAreaSource,
  ruleGroups: RegulationRuleGroup[],
): string | null {
  const normalizedCode = normalizeAreaCode(course.studyAreaCode)
  if (!normalizedCode) {
    return course.studyAreaName?.trim() || null
  }
  const match = buildCompletedCourseAreaOptions(course, ruleGroups)
    .find((option) => normalizeAreaCode(option.code) === normalizedCode)
  return match?.label ?? course.studyAreaName?.trim() ?? normalizedCode
}

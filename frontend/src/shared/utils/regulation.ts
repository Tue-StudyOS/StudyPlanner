import type { MasterCat, StudyAreaOption } from '../../features/courses'

export interface RegulationRuleGroup {
  code: string
  name: string
  groupType: string
  requiredEcts?: number | null
  minEcts?: number | null
  maxEcts?: number | null
  sortOrder?: number | null
}

export interface RegulationVersionDetail {
  code: string
  ruleGroups: RegulationRuleGroup[]
}

export interface RegulationAreaOption {
  code: string
  label: string
  shortLabel: string
  masterCat: MasterCat | null
  isFlexible: boolean
}

export function studyAreaCodeToMasterCat(studyAreaCode: string | null | undefined): MasterCat | null {
  const normalizedCode = studyAreaCode?.trim().toUpperCase() ?? ''
  if (!normalizedCode) {
    return null
  }
  if (normalizedCode.endsWith('TECH')) {
    return 'TECH'
  }
  if (normalizedCode.endsWith('THEO')) {
    return 'THEO'
  }
  if (normalizedCode.endsWith('PRAK')) {
    return 'PRAK'
  }
  if (normalizedCode === 'INFO' || normalizedCode === 'INFO-INFO' || normalizedCode === 'ML-CS' || normalizedCode.endsWith('-INFO')) {
    return 'INFO'
  }
  if (
    normalizedCode === 'ELECTIVE'
    || normalizedCode === 'INFO-FOKUS'
    || normalizedCode === 'ML-DIVERSE'
    || normalizedCode === 'ML-EXP'
    || normalizedCode === 'PROSEM'
    || normalizedCode === 'UEBK'
    || normalizedCode === 'MATH'
    || normalizedCode === 'INF'
    || normalizedCode === 'INFO-BASIS'
    || normalizedCode === 'ML-FOUND'
    || normalizedCode.endsWith('BASIS')
  ) {
    return 'BASIS'
  }
  return null
}

export function isFlexibleRegulationArea(
  ruleGroup: Pick<RegulationRuleGroup, 'code' | 'name' | 'groupType'>,
): boolean {
  const normalizedCode = ruleGroup.code.trim().toUpperCase()
  const normalizedName = ruleGroup.name.trim().toLowerCase()
  const normalizedGroupType = ruleGroup.groupType.trim().toLowerCase()

  if (normalizedCode === 'THESIS') {
    return false
  }
  if (normalizedCode === 'UEBK') {
    return true
  }
  if (normalizedGroupType === 'elective_area' || normalizedGroupType === 'structured_elective') {
    return true
  }
  if (
    [
      'PRAK',
      'TECH',
      'THEO',
      'INFO',
      'ELECTIVE',
      'INFO-PRAK',
      'INFO-TECH',
      'INFO-THEO',
      'INFO-INFO',
      'INFO-FOKUS',
      'INFO-BASIS',
      'ML-FOUND',
      'ML-DIVERSE',
      'ML-CS',
      'ML-EXP',
    ].includes(normalizedCode)
  ) {
    return true
  }

  return ['wahl', 'elective', 'fokus', 'basis', 'diverse', 'expanded'].some((keyword) =>
    normalizedName.includes(keyword),
  )
}

// The compulsory CS part is coded "INF", which reads almost identically to the
// "INFO" elective in tight dropdowns — show it as MAIN instead.
export function formatRegulationAreaShortLabel(
  code: string,
  groupType?: string | null,
): string {
  const normalizedCode = code.trim().toUpperCase()
  const normalizedGroupType = groupType?.trim().toLowerCase() ?? ''
  if (normalizedGroupType === 'pflicht' || normalizedCode === 'INF') {
    return 'MAIN'
  }
  return code
}

function buildAreaLabel(
  code: string,
  label: string | null | undefined,
  groupType?: string | null,
): { label: string; shortLabel: string } {
  const resolvedLabel = label?.trim() || code
  return {
    label: resolvedLabel === code ? code : `${code} · ${resolvedLabel}`,
    shortLabel: formatRegulationAreaShortLabel(code, groupType),
  }
}

function dedupeAreaOptions(options: RegulationAreaOption[]): RegulationAreaOption[] {
  const seenCodes = new Set<string>()
  return options.filter((option) => {
    if (seenCodes.has(option.code)) {
      return false
    }
    seenCodes.add(option.code)
    return true
  })
}

export function buildRelevantCourseAreaOptions(
  studyAreaOptions: StudyAreaOption[] | undefined,
  studyProgramCode: string | null | undefined,
): RegulationAreaOption[] {
  if (!studyAreaOptions || studyAreaOptions.length === 0) {
    return []
  }

  const filteredOptions = studyAreaOptions.filter(
    (option) => !studyProgramCode || option.programCode === studyProgramCode,
  )
  const relevantOptions = filteredOptions.length > 0 ? filteredOptions : studyProgramCode ? [] : studyAreaOptions

  return dedupeAreaOptions(
    relevantOptions
      .filter((option): option is StudyAreaOption & { studyAreaCode: string } => Boolean(option.studyAreaCode))
      .map((option) => {
        const labels = buildAreaLabel(option.studyAreaCode, option.studyAreaName)
        return {
          code: option.studyAreaCode,
          label: labels.label,
          shortLabel: labels.shortLabel,
          masterCat: studyAreaCodeToMasterCat(option.studyAreaCode),
          isFlexible: false,
        }
      }),
  )
}

export function buildMappedCourseAreaOptions(
  studyAreaOptions: StudyAreaOption[] | undefined,
  studyProgramCode: string | null | undefined,
): RegulationAreaOption[] {
  return buildRelevantCourseAreaOptions(studyAreaOptions, studyProgramCode)
}

export function buildFlexibleRegulationAreaOptions(
  ruleGroups: RegulationRuleGroup[],
): RegulationAreaOption[] {
  return dedupeAreaOptions(
    ruleGroups
      .filter((ruleGroup) => isFlexibleRegulationArea(ruleGroup))
      .map((ruleGroup) => {
        const labels = buildAreaLabel(ruleGroup.code, ruleGroup.name, ruleGroup.groupType)
        return {
          code: ruleGroup.code,
          label: labels.label,
          shortLabel: labels.shortLabel,
          masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
          isFlexible: true,
        }
      }),
  )
}

export function buildAllSelectableRegulationAreaOptions(
  ruleGroups: RegulationRuleGroup[],
): RegulationAreaOption[] {
  return dedupeAreaOptions(
    ruleGroups
      .filter((ruleGroup) => ruleGroup.code.trim().toUpperCase() !== 'THESIS')
      .map((ruleGroup) => {
        const labels = buildAreaLabel(ruleGroup.code, ruleGroup.name, ruleGroup.groupType)
        return {
          code: ruleGroup.code,
          label: labels.label,
          shortLabel: labels.shortLabel,
          masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
          isFlexible: isFlexibleRegulationArea(ruleGroup),
        }
      }),
  )
}

function isAlwaysAssignableArea(option: RegulationAreaOption): boolean {
  return option.code.trim().toUpperCase() === 'UEBK'
}

export function buildAssignableRegulationAreaOptions(
  studyAreaOptions: StudyAreaOption[] | undefined,
  studyProgramCode: string | null | undefined,
  ruleGroups: RegulationRuleGroup[],
  fallbackMasterCats: MasterCat[] = [],
): RegulationAreaOption[] {
  const mappedAreaOptions = buildRelevantCourseAreaOptions(studyAreaOptions, studyProgramCode)
  // Courses without an explicit regulation mapping may only go into elective
  // areas; compulsory parts are reserved for their explicitly mapped modules.
  // übK is open to everything regardless of category tags.
  const flexibleAreaOptions = buildFlexibleRegulationAreaOptions(ruleGroups)

  if (mappedAreaOptions.length === 0) {
    return flexibleAreaOptions
  }

  const preferredMasterCats = [...new Set(
    [...mappedAreaOptions.map((option) => option.masterCat), ...fallbackMasterCats]
      .filter((masterCat): masterCat is MasterCat => masterCat !== null),
  )]

  const compatibleAreaOptions = flexibleAreaOptions.filter(
    (option) =>
      isAlwaysAssignableArea(option)
      || (option.masterCat !== null && preferredMasterCats.includes(option.masterCat)),
  )

  return dedupeAreaOptions([...mappedAreaOptions, ...compatibleAreaOptions])
}

export function getEffectiveRuleGroupCapacity(ruleGroup: RegulationRuleGroup): number | null {
  if (typeof ruleGroup.maxEcts === 'number') {
    return ruleGroup.maxEcts
  }
  if (typeof ruleGroup.requiredEcts === 'number') {
    return ruleGroup.requiredEcts
  }
  return null
}

export function findRegulationAreaLabel(
  ruleGroups: RegulationRuleGroup[],
  studyAreaCode: string | null | undefined,
): string | null {
  if (!studyAreaCode) {
    return null
  }
  return ruleGroups.find((ruleGroup) => ruleGroup.code === studyAreaCode)?.name ?? null
}

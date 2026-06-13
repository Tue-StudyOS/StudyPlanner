import {
  buildSemesterOptions,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
  parseSemesterLabel,
} from '../../planner/utils/semesterLabels.ts'

export function buildManualSemesterOptions(
  startSemesterLabel: string | null | undefined,
  now: Date = new Date(),
): string[] {
  const currentSemesterLabel = getCurrentSemesterLabel(now)
  const latestSemesterLabel = getRelativeSemesterLabel(currentSemesterLabel, 1)
  const normalizedStartSemester = startSemesterLabel?.trim() ?? ''

  if (!parseSemesterLabel(normalizedStartSemester)) {
    return buildSemesterOptions([], currentSemesterLabel, currentSemesterLabel, latestSemesterLabel)
  }

  return buildSemesterOptions([], currentSemesterLabel, normalizedStartSemester, latestSemesterLabel)
}

export function getManualSemesterDefault(
  startSemesterLabel: string | null | undefined,
  options: string[],
): string {
  const normalizedStartSemester = startSemesterLabel?.trim() ?? ''
  if (options.includes(normalizedStartSemester)) {
    return normalizedStartSemester
  }
  return options.at(0) ?? ''
}

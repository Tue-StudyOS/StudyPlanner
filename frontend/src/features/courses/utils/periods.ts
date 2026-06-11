import type { CatalogPeriod } from '../types'

const SUMMER_SEMESTER_PATTERN = /^SS\s+(\d{4})$/
const WINTER_SEMESTER_PATTERN = /^WS\s+(\d{4})\s*\/\s*\d{2,4}$/

/**
 * Planner semester labels ("SS 2026", "WS 2025/26") and ALMA catalog period
 * labels ("Sommer 2026", "Winter 2025/26") describe the same semester in two
 * different formats, so the planner needs this translation to pick a period.
 */
export function semesterLabelToPeriodLabel(semesterLabel: string): string | null {
  const normalizedLabel = semesterLabel.trim().toUpperCase()

  const summerMatch = normalizedLabel.match(SUMMER_SEMESTER_PATTERN)
  if (summerMatch) {
    return `Sommer ${summerMatch[1]}`
  }

  const winterMatch = normalizedLabel.match(WINTER_SEMESTER_PATTERN)
  if (winterMatch) {
    const startYear = Number(winterMatch[1])
    return `Winter ${startYear}/${String(startYear + 1).slice(-2)}`
  }

  return null
}

export function findCatalogPeriodForSemesterLabel(
  periods: CatalogPeriod[],
  semesterLabel: string,
): CatalogPeriod | null {
  const periodLabel = semesterLabelToPeriodLabel(semesterLabel)
  if (!periodLabel) {
    return null
  }
  return periods.find((period) => period.label === periodLabel) ?? null
}

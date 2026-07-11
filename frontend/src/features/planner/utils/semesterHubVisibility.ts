import { getLecturePeriod } from './lecturePeriod.ts'
import {
  compareSemesterLabels,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
} from './semesterLabels.ts'

/** Next semester appears in the hub this many months before lectures start. */
export const UPCOMING_SEMESTER_HUB_VISIBILITY_MONTHS = 2

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getUpcomingSemesterHubVisibilityDate(semesterLabel: string): Date | null {
  const lecturePeriod = getLecturePeriod(semesterLabel)
  if (!lecturePeriod) {
    return null
  }

  const visibility = new Date(lecturePeriod.start)
  visibility.setMonth(visibility.getMonth() - UPCOMING_SEMESTER_HUB_VISIBILITY_MONTHS)
  return startOfLocalDay(visibility)
}

export function isUpcomingSemesterHubVisible(semesterLabel: string, now: Date = new Date()): boolean {
  const currentSemesterLabel = getCurrentSemesterLabel(now)
  if (compareSemesterLabels(semesterLabel, currentSemesterLabel) <= 0) {
    return true
  }

  const visibilityDate = getUpcomingSemesterHubVisibilityDate(semesterLabel)
  return visibilityDate !== null && startOfLocalDay(now) >= visibilityDate
}

export function getLatestSelectableSemesterLabel(now: Date = new Date()): string {
  const currentSemesterLabel = getCurrentSemesterLabel(now)
  const nextSemesterLabel = getRelativeSemesterLabel(currentSemesterLabel, 1)
  if (isUpcomingSemesterHubVisible(nextSemesterLabel, now)) {
    return nextSemesterLabel
  }
  return currentSemesterLabel
}

export function findOldestSemesterLabel(labels: string[]): string | null {
  return labels.reduce<string | null>(
    (oldestLabel, label) =>
      oldestLabel === null || compareSemesterLabels(label, oldestLabel) < 0
        ? label
        : oldestLabel,
    null,
  )
}

export function filterSemesterHubOptions(
  labels: string[],
  keepLabels: Array<string | null | undefined> = [],
  now: Date = new Date(),
): string[] {
  const keep = new Set(
    keepLabels
      .map((label) => label?.trim() ?? '')
      .filter((label) => label.length > 0),
  )
  return labels.filter((label) => keep.has(label) || isUpcomingSemesterHubVisible(label, now))
}

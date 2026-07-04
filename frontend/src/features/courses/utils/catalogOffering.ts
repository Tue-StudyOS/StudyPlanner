import { getCurrentSemesterLabel, parseSemesterLabel } from '../../planner/utils/semesterLabels.ts'
import type { Course, CourseTermType, StudyAreaOption } from '../types'

export type OfferingStatus = 'always' | 'confirmed' | 'likely' | 'unknown'
type TermSeason = 'summer' | 'winter'

interface ParsedPeriodLabel {
  season: TermSeason
  // Winter periods span two years; the start year identifies them ("Winter 2025/26" -> 2025).
  startYear: number
}

const PERIOD_LABEL_PATTERN = /^(Sommer|Winter)\s+(\d{4})/i

// Compulsory modules are marked through the examination regulation mapping:
// either an explicit mandatory option status, a Pflicht area type, or one of
// the compulsory area codes seeded for the Pflichtbereich.
const COMPULSORY_OPTION_STATUSES = new Set(['mandatory', 'required', 'pflicht'])
const COMPULSORY_AREA_TYPES = new Set(['mandatory', 'required', 'pflicht'])
const COMPULSORY_AREA_CODES = new Set(['INF', 'MATH', 'REQUIRED'])

export function parsePeriodLabel(label: string): ParsedPeriodLabel | null {
  const match = label.trim().match(PERIOD_LABEL_PATTERN)
  if (!match) {
    return null
  }
  return {
    season: match[1].toLowerCase() === 'sommer' ? 'summer' : 'winter',
    startYear: Number(match[2]),
  }
}

export function isCompulsoryCourse(course: Pick<Course, 'studyAreaOptions'>): boolean {
  return (course.studyAreaOptions ?? []).some((option: StudyAreaOption) => {
    const optionStatus = option.optionStatus?.trim().toLowerCase() ?? ''
    const areaType = option.areaType?.trim().toLowerCase() ?? ''
    const areaCode = option.studyAreaCode?.trim().toUpperCase() ?? ''
    return (
      COMPULSORY_OPTION_STATUSES.has(optionStatus)
      || COMPULSORY_AREA_TYPES.has(areaType)
      || COMPULSORY_AREA_CODES.has(areaCode)
    )
  })
}

function newestStartYearForSeason(labels: string[], season: TermSeason): number | null {
  let newestYear: number | null = null
  for (const label of labels) {
    const parsed = parsePeriodLabel(label)
    if (!parsed || parsed.season !== season) {
      continue
    }
    if (newestYear === null || parsed.startYear > newestYear) {
      newestYear = parsed.startYear
    }
  }
  return newestYear
}

function targetStartYearForSeason(season: TermSeason, now: Date): number {
  const currentSemester = parseSemesterLabel(getCurrentSemesterLabel(now))
  if (!currentSemester) {
    return now.getFullYear()
  }
  if (season === 'summer') {
    // During a winter semester the next summer term starts in the following year.
    return currentSemester.term === 'SS' ? currentSemester.year : currentSemester.year + 1
  }
  // The winter term starting in the current semester year is always the next
  // (or currently running) winter occurrence.
  return currentSemester.year
}

const STATUS_RANK: Record<OfferingStatus, number> = {
  always: 3,
  confirmed: 2,
  likely: 1,
  unknown: 0,
}

export function isDefaultVisibleOfferingStatus(status: OfferingStatus | undefined): boolean {
  return status === undefined || status === 'always' || status === 'confirmed'
}

export function isOutdatedOfferingStatus(status: OfferingStatus | undefined): boolean {
  return status === 'unknown'
}

export function getOutdatedOfferingSortRank(status: OfferingStatus | undefined): number {
  return isOutdatedOfferingStatus(status) ? 1 : 0
}

export function resolveUnconfirmedOfferingVisibility(
  showUnconfirmedOfferings: boolean,
  isOnboardingOpen: boolean,
): boolean {
  return showUnconfirmedOfferings || isOnboardingOpen
}

/**
 * Offering status of a course relative to its next (or currently running)
 * semester occurrence:
 *
 * - `always`: compulsory module, fixed by the examination regulations.
 * - `confirmed`: catalog data exists for the target semester.
 * - `likely`: no catalog data for the target semester yet, but the course ran
 *   in the most recent same-season semester we have data for.
 * - `unknown`: the course did not run in the most recent same-season semester;
 *   there is no signal it will return.
 */
export function getOfferingStatus(
  course: Pick<Course, 'offeredPeriods' | 'studyAreaOptions'>,
  knownPeriodLabels: string[],
  now: Date = new Date(),
): OfferingStatus {
  if (isCompulsoryCourse(course)) {
    return 'always'
  }

  const offeredPeriods = course.offeredPeriods ?? []
  let bestStatus: OfferingStatus = 'unknown'

  for (const season of ['summer', 'winter'] as const) {
    const courseNewestYear = newestStartYearForSeason(offeredPeriods, season)
    if (courseNewestYear === null) {
      continue
    }

    const knownNewestYear = newestStartYearForSeason(knownPeriodLabels, season)
    const targetYear = targetStartYearForSeason(season, now)

    let seasonStatus: OfferingStatus
    if (knownNewestYear !== null && knownNewestYear >= targetYear) {
      seasonStatus = courseNewestYear >= targetYear ? 'confirmed' : 'unknown'
    } else {
      seasonStatus = courseNewestYear === knownNewestYear ? 'likely' : 'unknown'
    }

    if (STATUS_RANK[seasonStatus] > STATUS_RANK[bestStatus]) {
      bestStatus = seasonStatus
    }
  }

  return bestStatus
}

function wasOfferedInSeasonYear(labels: string[], season: TermSeason, startYear: number): boolean {
  return labels.some((label) => {
    const parsed = parsePeriodLabel(label)
    return parsed !== null && parsed.season === season && parsed.startYear === startYear
  })
}

/**
 * Season tags to display for a course. A season is only tagged when the course
 * was offered in the most recent *completed* semester of that season relative to
 * `now`; the currently running semester does not count yet. During a summer term
 * the reference summer is therefore the previous year's summer, while the
 * reference winter is the winter that just ended (and vice versa during winter).
 */
export function getLatestKnownSeasonTermType(
  course: Pick<Course, 'offeredPeriods'>,
  knownPeriodLabels: string[],
): CourseTermType {
  const offeredPeriods = course.offeredPeriods ?? []
  const newestSummerYear = newestStartYearForSeason(knownPeriodLabels, 'summer')
  const newestWinterYear = newestStartYearForSeason(knownPeriodLabels, 'winter')
  const hasSummer = newestSummerYear !== null
    && wasOfferedInSeasonYear(offeredPeriods, 'summer', newestSummerYear)
  const hasWinter = newestWinterYear !== null
    && wasOfferedInSeasonYear(offeredPeriods, 'winter', newestWinterYear)

  if (hasSummer && hasWinter) {
    return 'both'
  }
  if (hasSummer) {
    return 'summer'
  }
  if (hasWinter) {
    return 'winter'
  }
  return 'unknown'
}

export function getRecentSeasonTermType(
  course: Pick<Course, 'offeredPeriods'>,
  now: Date = new Date(),
): CourseTermType {
  const current = parseSemesterLabel(getCurrentSemesterLabel(now))
  if (!current) {
    return 'unknown'
  }

  // The running term is excluded, so the last completed same-season term is one
  // year back; the off-season's last completed term is the one that just ended.
  const summerReferenceYear = current.term === 'SS' ? current.year - 1 : current.year
  const winterReferenceYear = current.year - 1

  const offeredPeriods = course.offeredPeriods ?? []
  const hasSummer = wasOfferedInSeasonYear(offeredPeriods, 'summer', summerReferenceYear)
  const hasWinter = wasOfferedInSeasonYear(offeredPeriods, 'winter', winterReferenceYear)

  if (hasSummer && hasWinter) {
    return 'both'
  }
  if (hasSummer) {
    return 'summer'
  }
  if (hasWinter) {
    return 'winter'
  }
  return 'unknown'
}

/** Detail header: show the split icon whenever the course runs in both seasons. */
export function getDetailSeasonTermType(
  course: Pick<Course, 'termType' | 'offeredPeriods'>,
  now: Date = new Date(),
): CourseTermType {
  if (course.termType === 'both') {
    return 'both'
  }

  const offeredPeriods = course.offeredPeriods ?? []
  let hasSummer = false
  let hasWinter = false
  for (const label of offeredPeriods) {
    const parsed = parsePeriodLabel(label)
    if (parsed?.season === 'summer') {
      hasSummer = true
    }
    if (parsed?.season === 'winter') {
      hasWinter = true
    }
  }
  if (hasSummer && hasWinter) {
    return 'both'
  }

  return getRecentSeasonTermType(course, now)
}


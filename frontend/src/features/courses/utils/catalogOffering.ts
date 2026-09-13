import {
  formatSemesterLabelShort,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
  parseSemesterLabel,
} from '../../planner/utils/semesterLabels.ts'
import type { Course, CourseTermType, StudyAreaOption } from '../types'

export type OfferingStatus = 'confirmed' | 'likely' | 'unknown'
export type TermSeason = 'summer' | 'winter'

const TERM_SEASONS: readonly TermSeason[] = ['summer', 'winter']

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

/**
 * The semester the catalog plans for: the running semester, except in its final
 * month (September / March), when students are already choosing courses for the
 * upcoming one and the ending semester is no longer relevant.
 */
export function getPlanningSemesterLabel(now: Date = new Date()): string {
  return getCurrentSemesterLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1))
}

function getSemesterSeason(semesterLabel: string): TermSeason | null {
  const semester = parseSemesterLabel(semesterLabel)
  if (!semester) {
    return null
  }
  return semester.term === 'SS' ? 'summer' : 'winter'
}

/** Preselected term chips: the upcoming season once the running semester is in its final month. */
export function getDefaultCatalogTermSelection(now: Date = new Date()): TermSeason[] {
  const planningSemesterLabel = getPlanningSemesterLabel(now)
  if (planningSemesterLabel === getCurrentSemesterLabel(now)) {
    return []
  }
  const season = getSemesterSeason(planningSemesterLabel)
  return season ? [season] : []
}

/** The planning semester and the one after it, i.e. the next occurrence of each season. */
function getTargetSemesterLabels(now: Date): string[] {
  const planningSemesterLabel = getPlanningSemesterLabel(now)
  return [planningSemesterLabel, getRelativeSemesterLabel(planningSemesterLabel, 1)]
}

function targetStartYearForSeason(season: TermSeason, now: Date): number {
  for (const label of getTargetSemesterLabels(now)) {
    const semester = parseSemesterLabel(label)
    if (semester && getSemesterSeason(label) === season) {
      return semester.year
    }
  }
  return now.getFullYear()
}

function resolveSeasons(seasons: readonly TermSeason[]): readonly TermSeason[] {
  return seasons.length > 0 ? seasons : TERM_SEASONS
}

/**
 * The semesters offering confirmation is checked against for the selected term
 * chips (all seasons when none is selected), e.g. "WS 26/27" or "WS 26/27 / SS 27".
 * Shown on the catalog toggle so it is explicit which semesters "confirmed" means.
 */
export function getOfferingTargetSemesterLabel(
  seasons: readonly TermSeason[] = [],
  now: Date = new Date(),
): string {
  const selectedSeasons = resolveSeasons(seasons)
  return getTargetSemesterLabels(now)
    .filter((label) => {
      const season = getSemesterSeason(label)
      return season !== null && selectedSeasons.includes(season)
    })
    .map(formatSemesterLabelShort)
    .join(' / ')
}

/** Term chip match: the course has run in at least one selected season (any season when none is selected). */
export function courseRanInSeasons(
  course: Pick<Course, 'offeredPeriods'>,
  seasons: readonly TermSeason[],
): boolean {
  if (seasons.length === 0) {
    return true
  }
  return seasons.some((season) => newestStartYearForSeason(course.offeredPeriods ?? [], season) !== null)
}

const STATUS_RANK: Record<OfferingStatus, number> = {
  confirmed: 2,
  likely: 1,
  unknown: 0,
}

export function isDefaultVisibleOfferingStatus(status: OfferingStatus | undefined): boolean {
  return status === undefined || status === 'confirmed'
}

export function isOutdatedOfferingStatus(status: OfferingStatus | undefined): boolean {
  return status === 'unknown'
}

export function getOutdatedOfferingSortRank(status: OfferingStatus | undefined): number {
  return isOutdatedOfferingStatus(status) ? 1 : 0
}

const CATALOG_TOUR_UNCONFIRMED_PREVIEW_STEP_IDS = new Set([
  'catalog-progress-hint',
  'catalog-search',
  'catalog-filters',
  'catalog-card',
  'catalog-card-likely',
  'catalog-card-unknown',
])

export function isCatalogTourUnconfirmedPreviewStep(activeStepId: string | null): boolean {
  return activeStepId !== null && CATALOG_TOUR_UNCONFIRMED_PREVIEW_STEP_IDS.has(activeStepId)
}

export function resolveUnconfirmedOfferingVisibility(
  showUnconfirmedOfferings: boolean,
  isOnboardingOpen: boolean,
  activeStepId: string | null,
): boolean {
  if (showUnconfirmedOfferings) {
    return true
  }
  if (!isOnboardingOpen) {
    return false
  }
  if (activeStepId === 'reopen-guide') {
    return false
  }
  return isCatalogTourUnconfirmedPreviewStep(activeStepId)
}

/** Tour checkbox: forced on while introducing catalog cards; mirrors user setting on reopen-guide. */
export function resolveUnconfirmedOfferingToggleChecked(
  showUnconfirmedOfferings: boolean,
  isOnboardingOpen: boolean,
  activeStepId: string | null,
): boolean {
  if (!isOnboardingOpen) {
    return showUnconfirmedOfferings
  }
  if (activeStepId === 'reopen-guide') {
    return showUnconfirmedOfferings
  }
  if (isCatalogTourUnconfirmedPreviewStep(activeStepId)) {
    return true
  }
  return showUnconfirmedOfferings
}

/**
 * Offering status of a course relative to the target semester of each given
 * season (all seasons when none is given; the best season wins). Only the given
 * seasons count, so a course confirmed for summer is not confirmed for winter.
 *
 * - `confirmed`: catalog data exists for the target semester.
 * - `likely`: no catalog data for the target semester yet, but the course ran
 *   in the most recent same-season semester we have data for.
 * - `unknown`: the course did not run in the most recent same-season semester;
 *   there is no signal it will return.
 *
 * Compulsory modules get no exemption: the toggle label names the semesters it
 * checks, and silently showing unconfirmed Pflicht courses contradicted it.
 */
export function getOfferingStatus(
  course: Pick<Course, 'offeredPeriods'>,
  knownPeriodLabels: string[],
  now: Date = new Date(),
  seasons: readonly TermSeason[] = [],
): OfferingStatus {
  const offeredPeriods = course.offeredPeriods ?? []
  let bestStatus: OfferingStatus = 'unknown'

  for (const season of resolveSeasons(seasons)) {
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

export function getCatalogCardSeasonTermType(
  course: Pick<Course, 'termType' | 'offeredPeriods'>,
  knownPeriodLabels: string[],
  now: Date = new Date(),
): CourseTermType {
  const latestKnownTermType = getLatestKnownSeasonTermType(course, knownPeriodLabels)
  return latestKnownTermType !== 'unknown'
    ? latestKnownTermType
    : getDetailSeasonTermType(course, now)
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


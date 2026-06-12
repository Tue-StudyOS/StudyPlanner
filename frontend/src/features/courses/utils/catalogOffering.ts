import { getCurrentSemesterLabel, parseSemesterLabel } from '../../planner/utils/semesterLabels.ts'
import type { Course, StudyAreaOption } from '../types'

export type OfferingStatus = 'always' | 'confirmed' | 'likely' | 'unknown'
export type TermSeason = 'summer' | 'winter'

export interface ParsedPeriodLabel {
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


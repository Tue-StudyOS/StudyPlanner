import { parseSemesterLabel } from './semesterLabels.ts'

export interface LecturePeriod {
  start: Date
  end: Date
}

const MONDAY = 1
const SATURDAY = 6

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number): Date {
  const firstOfMonth = new Date(year, monthIndex, 1)
  const offsetToFirst = (weekday - firstOfMonth.getDay() + 7) % 7
  return new Date(year, monthIndex, 1 + offsetToFirst + (nth - 1) * 7)
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): Date {
  const lastOfMonth = new Date(year, monthIndex + 1, 0)
  const offsetBack = (lastOfMonth.getDay() - weekday + 7) % 7
  return new Date(year, monthIndex, lastOfMonth.getDate() - offsetBack)
}

/**
 * Tübingen lecture periods follow a fixed rule: lectures start on the second
 * Monday of April (summer) / October (winter) and end on the last Saturday of
 * July (summer) / February (winter). Anchor: SoSe 2026 ran Mon 2026-04-13
 * through Sat 2026-07-25.
 */
export function getLecturePeriod(semesterLabel: string): LecturePeriod | null {
  const parsedSemester = parseSemesterLabel(semesterLabel)
  if (!parsedSemester) {
    return null
  }

  if (parsedSemester.term === 'SS') {
    return {
      start: nthWeekdayOfMonth(parsedSemester.year, 3, MONDAY, 2),
      end: lastWeekdayOfMonth(parsedSemester.year, 6, SATURDAY),
    }
  }

  return {
    start: nthWeekdayOfMonth(parsedSemester.year, 9, MONDAY, 2),
    end: lastWeekdayOfMonth(parsedSemester.year + 1, 1, SATURDAY),
  }
}

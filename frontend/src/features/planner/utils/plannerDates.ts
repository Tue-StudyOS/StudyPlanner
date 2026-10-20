import { parseSemesterLabel } from './semesterLabels.ts'

const DAY_MS = 86_400_000
export const CALENDAR_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type CalendarDay = (typeof CALENDAR_DAYS)[number]

/** Civil dates use UTC arithmetic, never local-midnight durations (DST). */
export function parseCalendarDate(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ''
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/)
  if (!iso && !german) return null
  const year = iso ? Number(iso[1]) : Number(german![3]) + (german![3].length === 2 ? 2000 : 0)
  const month = Number(iso ? iso[2] : german![2])
  const day = Number(iso ? iso[3] : german![1])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10) : null
}

export function datesInDayText(text: string): string[] | null {
  const tokens = text.match(/\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2}))\b/g) ?? []
  const dates = tokens.map(parseCalendarDate)
  return dates.some((date) => date === null) || dates.length > 2 ? null : dates as string[]
}

export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function calendarDayDistance(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS
}

export function calendarWeekday(date: string): CalendarDay {
  return CALENDAR_DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]
}

export function startOfCalendarWeek(date: string): string {
  return addCalendarDays(date, -CALENDAR_DAYS.indexOf(calendarWeekday(date)))
}

export function localCalendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function initialCalendarWeek(semesterLabel: string, today: string = localCalendarDate(new Date())): string {
  const semester = parseSemesterLabel(semesterLabel)
  if (!semester) return startOfCalendarWeek(today)
  const start = `${semester.year}-${semester.term === 'SS' ? '04' : '10'}-01`
  const end = semester.term === 'SS' ? `${semester.year}-09-30` : `${semester.year + 1}-03-31`
  return startOfCalendarWeek(today >= start && today <= end ? today : start)
}

export function formatCalendarDate(date: string, weekday = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    ...(weekday ? { weekday: 'short' as const } : {}),
  }).format(new Date(`${date}T00:00:00Z`))
}

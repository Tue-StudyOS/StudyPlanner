import type { Course, ScheduleSlot } from '../../courses/types.ts'
import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'
import { getScheduleSlotKind, getScheduleSlotTypeLabel } from '../../courses/utils/scheduleSlotKind.ts'
import type { ManualPlannerSlot } from '../types.ts'
import { getLecturePeriod } from './lecturePeriod.ts'
import { getPlannerSessionRole, normalizeWeekday, parseTimeRange, type PlannerBlock } from './plannerFeedback.ts'
import { getScheduleSlotId, getScheduleSlotLegacyIds, isScheduleSlotHidden } from './scheduleSlotIds.ts'
import {
  addCalendarDays, calendarDayDistance, calendarWeekday, datesInDayText,
  localCalendarDate, parseCalendarDate, type CalendarDay,
} from './plannerDates.ts'

export interface CalendarPattern {
  kind: 'weekly' | 'fortnightly' | 'block' | 'single' | 'unknown'
  start: string | null
  end: string | null
  first: string | null
  weekday: CalendarDay | null
  weekends: boolean
  cancellations: string[]
  reason: string | null
}

export function calendarTimeRange(text: string): { startMinutes: number; endMinutes: number } | null {
  const range = parseTimeRange(text)
  return range && /^\s*\d{1,2}:[0-5]\d\s*[-–—]\s*\d{1,2}:[0-5]\d\s*(?:Uhr\s*)?(?:[cs]\.?\s*t\.?)?\s*$/i.test(text)
    && range.startMinutes >= 0 && range.startMinutes < 1440
    && range.endMinutes <= 1440 && range.endMinutes > range.startMinutes ? range : null
}

function slotWeekday(text: string): CalendarDay | null {
  // Only weekday aliases come from the label; dated labels must not override structured bounds.
  if ((datesInDayText(text)?.length ?? 0) > 0) return null
  const normalized = normalizeWeekday(text)
  if (normalized) return normalized
  if (/^(sa\.?|sat|saturday|samstag)$/i.test(text.trim())) return 'Saturday'
  if (/^(so\.?|sun|sunday|sonntag)$/i.test(text.trim())) return 'Sunday'
  return null
}

/** Missing legacy rhythms may use a concrete weekday; an explicit unknown never does. */
export function classifyCalendarSlot(slot: ScheduleSlot, semesterLabel: string): CalendarPattern {
  const fallback = getLecturePeriod(semesterLabel)
  const textDates = datesInDayText(slot.day)
  const hasStart = Boolean(slot.startsOn?.trim())
  const hasEnd = Boolean(slot.endsOn?.trim())
  const structured = hasStart || hasEnd
  const start = hasStart ? parseCalendarDate(slot.startsOn) : structured ? null : textDates?.[0] ?? null
  const end = hasEnd ? parseCalendarDate(slot.endsOn) : structured ? null : textDates?.at(-1) ?? null
  const invalid = (hasStart && !start) || (hasEnd && !end) || (!structured && textDates === null)
  const rhythm = slot.rhythm?.trim().toLowerCase() ?? ''
  const weekday = slotWeekday(slot.day) ?? (start ? calendarWeekday(start) : null)
  const pattern: CalendarPattern = {
    kind: 'unknown', start, end, first: null, weekday,
    weekends: /sa\s+und\s+so|inkl.*wochenend|including weekends/i.test(rhythm),
    cancellations: (slot.cancellationDates ?? []).flatMap((date) => parseCalendarDate(date) ?? []),
    reason: null,
  }
  if (invalid || (start && end && start > end)) {
    return { ...pattern, reason: 'Invalid or reversed source dates' }
  }
  if (start && start === end) pattern.kind = 'single'
  else if (/^(einzeltermin|single|one-off)$/.test(rhythm)) pattern.kind = 'single'
  else if (/^blockveranstaltung(?:\s*\+\s*sa\s+und\s+so)?$/.test(rhythm)) pattern.kind = 'block'
  else if (/^(14-täglich|14-tägig|14-taeglich|14-taegig|14 tägig|vierzehntäglich|fortnightly|biweekly)$/.test(rhythm)) pattern.kind = 'fortnightly'
  else if (/^(wöchentlich|woechentlich|weekly)$/.test(rhythm) || (!rhythm && weekday)) pattern.kind = 'weekly'
  if (pattern.kind === 'single' || pattern.kind === 'block') {
    if (!start || (pattern.kind === 'block' && !end) || (pattern.kind === 'single' && end && start !== end)) {
      return { ...pattern, kind: 'unknown', reason: 'Exact appointment dates not published' }
    }
    return { ...pattern, end: end ?? start, first: start }
  }
  if (pattern.kind === 'unknown') return { ...pattern, reason: 'Recurrence not published or unsupported' }
  if (!weekday) return { ...pattern, kind: 'unknown', reason: 'Weekday not published' }
  const boundedStart = start ?? (fallback ? localCalendarDate(fallback.start) : null)
  const boundedEnd = end ?? (fallback ? localCalendarDate(fallback.end) : null)
  if (!boundedStart || !boundedEnd || boundedStart > boundedEnd) {
    return { ...pattern, kind: 'unknown', reason: 'Appointment bounds not available' }
  }
  let first = boundedStart
  while (calendarWeekday(first) !== weekday) first = addCalendarDays(first, 1)
  return { ...pattern, start: boundedStart, end: boundedEnd, first }
}

export function calendarPatternDates(pattern: CalendarPattern, from?: string, through?: string): string[] {
  if (pattern.kind === 'unknown' || !pattern.first || !pattern.end) return []
  const dates: string[] = []
  const start = from && from > pattern.first ? from : pattern.first
  const end = through && through < pattern.end ? through : pattern.end
  for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
    const distance = calendarDayDistance(pattern.first, date)
    const matches = pattern.kind === 'single' ? distance === 0
      : pattern.kind === 'block' ? pattern.weekends || !['Saturday', 'Sunday'].includes(calendarWeekday(date))
        : distance % (pattern.kind === 'fortnightly' ? 14 : 7) === 0
    if (matches && !pattern.cancellations.includes(date)) dates.push(date)
  }
  return dates
}

function examIdentity(type: string): string {
  return type.trim().toLowerCase().replace(/^(klausur|prüfung|pruefung|exam)$/, 'exam').replace(/^(nachklausur|resit)$/, 'resit')
}

/** Metadata has no time. Match date AND exam type, never unrelated exams on the same day. */
export function calendarMetadataExams(course: Course, semesterLabel: string): Array<{ date: string; type: string; index: number }> {
  const seen = new Set<string>()
  for (const slot of course.schedule) {
    if (slot.calendarRelevant === false || !['exam', 'resit'].includes(getScheduleSlotKind(slot))) continue
    const pattern = classifyCalendarSlot(slot, semesterLabel)
    for (const date of calendarPatternDates({ ...pattern, cancellations: [] })) {
      const type = !slot.type.trim() || slot.type === 'Course' ? getScheduleSlotKind(slot) : slot.type
      seen.add(`${date}|${examIdentity(type)}`)
    }
  }
  return course.exams.flatMap((exam, index) => {
    const date = parseCalendarDate(exam.date)
    const key = `${date}|${examIdentity(exam.type)}`
    if (!date || seen.has(key)) return []
    seen.add(key)
    return [{ date, type: exam.type, index }]
  })
}

export type CalendarBlock = Omit<PlannerBlock, 'day'> & { day: CalendarDay; date: string }
export interface CalendarDateItem {
  id: string
  courseId: string
  courseTitle: string
  date: string
  label: string
}
export interface UnresolvedCalendarItem {
  id: string
  courseId: string
  label: string
}

export function buildPlannerWeek({ courses, manualSlots = [], hiddenSlotIds = [], semesterLabel, weekStart }: {
  courses: Course[]
  manualSlots?: readonly ManualPlannerSlot[]
  hiddenSlotIds?: readonly string[]
  semesterLabel: string
  weekStart: string
}): { blocks: CalendarBlock[]; dateItems: CalendarDateItem[]; unresolved: UnresolvedCalendarItem[]; courseIds: string[] } {
  const blocks: CalendarBlock[] = []
  const dateItems: CalendarDateItem[] = []
  const unresolved: UnresolvedCalendarItem[] = []
  const weekEnd = addCalendarDays(weekStart, 6)
  for (const course of courses) {
    const courseTitle = cleanCourseTitle(course.title, course.number)
    const slots = [
      ...course.schedule.map((slot, index) => ({ slot, index, manual: null as ManualPlannerSlot | null })),
      ...manualSlots.filter((manual) => manual.courseId === course.id).map((manual) => ({
        slot: { day: manual.day, time: manual.time, room: manual.room ?? '', type: manual.label ?? 'Manual', rhythm: 'weekly' } as ScheduleSlot,
        index: -1, manual,
      })),
    ]
    for (const { slot, index, manual } of slots) {
      const slotId = manual ? `manual:${manual.id}` : getScheduleSlotId(course, slot, index)
      if (slot.calendarRelevant === false || (manual ? hiddenSlotIds.includes(slotId) : isScheduleSlotHidden(hiddenSlotIds, course, slot, index))) continue
      const pattern = classifyCalendarSlot(slot, semesterLabel)
      const time = calendarTimeRange(slot.time)
      if (pattern.kind === 'unknown' || !time) {
        unresolved.push({ id: slotId, courseId: course.id, label: [slot.type, slot.day, slot.time, slot.rhythm, pattern.reason ?? 'Time not published'].filter(Boolean).join(' · ') })
      }
      const dates = calendarPatternDates(pattern, weekStart, weekEnd)
      // An unknown rhythm with a published date remains visible as unresolved, not a timed recurrence.
      if (pattern.kind === 'unknown' && !pattern.reason?.startsWith('Invalid') && pattern.start && !pattern.cancellations.includes(pattern.start) && pattern.start >= weekStart && pattern.start <= weekEnd) {
        dateItems.push({ id: `${slotId}:unresolved`, courseId: course.id, courseTitle, date: pattern.start, label: `${slot.type} · Recurrence unresolved (${slot.rhythm || 'not published'})` })
      }
      for (const date of dates) {
        if (!time) {
          dateItems.push({ id: `${slotId}:${date}`, courseId: course.id, courseTitle, date, label: `${slot.type} · Time not published` })
          continue
        }
        blocks.push({
          blockId: `${slotId}:${date}`, slotId, legacySlotIds: manual ? [] : getScheduleSlotLegacyIds(course, slot, index),
          courseId: course.id, courseTitle, date, day: calendarWeekday(date), ...time,
          label: slot.time, room: slot.room, slotType: getScheduleSlotTypeLabel(slot),
          slotKind: getScheduleSlotKind(slot), sessionRole: getPlannerSessionRole(slot), hasOverlap: false, isManual: Boolean(manual),
        })
      }
    }
    for (const exam of calendarMetadataExams(course, semesterLabel)) {
      if (exam.date >= weekStart && exam.date <= weekEnd) dateItems.push({
        id: `${course.id}:exam:${exam.index}`, courseId: course.id, courseTitle, date: exam.date, label: `${exam.type} · Time not published`,
      })
    }
    for (const [index, exam] of course.exams.entries()) {
      if (!parseCalendarDate(exam.date)) unresolved.push({ id: `${course.id}:exam:${index}`, courseId: course.id, label: `${exam.type} · ${exam.date || 'Date not published'}` })
    }
  }
  return { blocks, dateItems, unresolved, courseIds: courses.map((course) => course.id) }
}

export function calendarTimeBounds(blocks: readonly CalendarBlock[]): { startHour: number; endHour: number } {
  return {
    startHour: Math.min(8, ...blocks.map((block) => Math.floor(block.startMinutes / 60))),
    endHour: Math.max(20, ...blocks.map((block) => Math.ceil(block.endMinutes / 60))),
  }
}

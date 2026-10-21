import type { Course } from '../../courses'
import type { ManualPlannerSlot } from '../types.ts'
import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'
import { getLecturePeriod } from './lecturePeriod.ts'
import { DAY_ORDER } from './plannerFeedback.ts'
import { calendarMetadataExams, calendarPatternDates, calendarTimeRange, classifyCalendarSlot } from './plannerCalendar.ts'
import { addCalendarDays, localCalendarDate, type CalendarDay } from './plannerDates.ts'
import { getScheduleSlotId, isScheduleSlotHidden } from './scheduleSlotIds.ts'
import { isTutorialLikeSlotType } from './plannerSlotSelection.ts'

type Weekday = (typeof DAY_ORDER)[number]

const ICAL_DAY: Record<CalendarDay, string> = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
  Sunday: 'SU',
}

const JS_DAY_INDEX: Record<Weekday, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatIcsDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function formatIcsDateTime(date: Date, minutesOfDay: number): string {
  const eventDate = new Date(date)
  eventDate.setDate(eventDate.getDate() + Math.floor(minutesOfDay / 1440))
  const hours = Math.floor((minutesOfDay % 1440) / 60)
  const minutes = minutesOfDay % 60
  return `${formatIcsDate(eventDate)}T${pad(hours)}${pad(minutes)}00`
}

function recurrenceUntil(date: string): string {
  // UNTIL is UTC, but bounds are Berlin civil dates (including late winter events).
  const berlinHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date(`${date}T12:00:00Z`)))
  return `${date.replaceAll('-', '')}T${23 - (berlinHour - 12)}5959Z`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function civilDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function firstWeekdayOnOrAfter(start: Date, weekdayIndex: number): Date {
  const result = new Date(start)
  const offset = (weekdayIndex - result.getDay() + 7) % 7
  result.setDate(result.getDate() + offset)
  return result
}

export function downloadCalendarIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export interface CourseCalendarOptions {
  tutorialSlotIds?: readonly string[] | 'all'
  includeExams?: boolean
  includeResits?: boolean
}

export function getCourseExportTutorialOptions(course: Course): Array<{ id: string; label: string }> {
  return course.schedule.flatMap((slot, index) => {
    const role = slot.type && slot.type !== 'Course'
      ? slot.type : [slot.groupType, slot.groupTitle].filter(Boolean).join(' ')
    return slot.calendarRelevant !== false && isTutorialLikeSlotType(role)
      ? [{ id: getScheduleSlotId(course, slot, index), label: [slot.day, slot.time, slot.room, slot.groupTitle].filter(Boolean).join(' · ') }]
      : []
  })
}

export function buildCourseIcs(course: Course, options: CourseCalendarOptions = {}): string | null {
  const tutorials = new Set(getCourseExportTutorialOptions(course).map((option) => option.id))
  const selected = options.tutorialSlotIds ?? []
  const includeExam = (type: string): boolean => {
    if (/nachklausur|resit/i.test(type)) return options.includeResits !== false
    if (/klausur|pruefung|prüfung|exam/i.test(type)) return options.includeExams !== false
    return true
  }
  const hiddenSlotIds = course.schedule.flatMap((slot, index) =>
    !includeExam(slot.type) || (tutorials.has(getScheduleSlotId(course, slot, index))
      && selected !== 'all' && !selected.includes(getScheduleSlotId(course, slot, index)))
      ? [getScheduleSlotId(course, slot, index)]
      : [],
  )
  const content = buildSemesterPlanIcs({
    semesterLabel: (course.periodLabel ?? '').replace(/^Sommer\b/i, 'SS').replace(/^Winter\b/i, 'WS'),
    courses: [{ ...course, exams: course.exams.filter((exam) => includeExam(exam.type)) }],
    hiddenSlotIds,
  })
  return content?.includes('BEGIN:VEVENT') ? content : null
}

interface SemesterIcsInput {
  semesterLabel: string
  courses: Course[]
  hiddenSlotIds: string[]
  manualSlots?: ManualPlannerSlot[]
}

/**
 * Builds an iCalendar file for the planned semester: one weekly recurring
 * event per weekly schedule slot, plus dated events for blocks, one-offs and
 * published exam dates. Returns null when the semester label is unparseable.
 */
export function buildSemesterPlanIcs({
  semesterLabel,
  courses,
  hiddenSlotIds,
  manualSlots = [],
}: SemesterIcsInput): string | null {
  const lecturePeriod = getLecturePeriod(semesterLabel)
  if (!lecturePeriod) {
    return null
  }

  const defaultUntilValue = recurrenceUntil(localCalendarDate(lecturePeriod.end))
  const events: string[] = []

  courses.forEach((course) => {
    const title = cleanCourseTitle(course.title, course.number)

    course.schedule.forEach((slot, index) => {
      if (
        slot.calendarRelevant === false
        || isScheduleSlotHidden(hiddenSlotIds, course, slot, index)
      ) {
        return
      }
      const slotId = getScheduleSlotId(course, slot, index).replace(/[^a-zA-Z0-9.-]/g, '-')
      const pattern = classifyCalendarSlot(slot, semesterLabel)
      const timeRange = calendarTimeRange(slot.time)
      if (pattern.kind === 'unknown') return
      const summary = slot.type && slot.type !== 'Course' ? `${title} (${slot.type})` : title
      const recurring = Boolean(timeRange && ['weekly', 'fortnightly'].includes(pattern.kind))
      const dates = recurring && pattern.first && pattern.end && pattern.first <= pattern.end
        ? [pattern.first] : calendarPatternDates(pattern)
      dates.forEach((date) => {
        const lines = ['BEGIN:VEVENT', `UID:${slotId}${recurring ? '' : `-${date}`}@studyplanner`]
        if (timeRange) {
          lines.push(
            `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(civilDate(date), timeRange.startMinutes)}`,
            `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(civilDate(date), timeRange.endMinutes)}`,
          )
        } else {
          lines.push(`DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${addCalendarDays(date, 1).replaceAll('-', '')}`)
        }
        if (recurring && pattern.weekday && pattern.end && timeRange) {
          lines.push(`RRULE:FREQ=WEEKLY;${pattern.kind === 'fortnightly' ? 'INTERVAL=2;' : ''}BYDAY=${ICAL_DAY[pattern.weekday]};UNTIL=${recurrenceUntil(pattern.end)}`)
          if (pattern.cancellations.length) lines.push(`EXDATE;TZID=Europe/Berlin:${pattern.cancellations.map((value) => formatIcsDateTime(civilDate(value), timeRange.startMinutes)).join(',')}`)
        }
        lines.push(`SUMMARY:${escapeIcsText(summary)}`)
        if (timeRange) lines.push(`DESCRIPTION:${escapeIcsText(`Time as published: ${slot.time}`)}`)
        if (slot.room && slot.room !== 'TBA') lines.push(`LOCATION:${escapeIcsText(slot.room)}`)
        lines.push('END:VEVENT')
        events.push(lines.join('\r\n'))
      })
    })

    calendarMetadataExams(course, semesterLabel).forEach((exam) => {
      events.push([
        'BEGIN:VEVENT',
        `UID:${course.id}-exam-${exam.index}@studyplanner`,
        `DTSTART;VALUE=DATE:${exam.date.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${addCalendarDays(exam.date, 1).replaceAll('-', '')}`,
        `SUMMARY:${escapeIcsText(`${title} – ${exam.type}`)}`,
        'END:VEVENT',
      ].join('\r\n'))
    })
  })

  const coursesById = new Map(courses.map((course) => [course.id, course]))
  manualSlots.forEach((manualSlot) => {
    if (hiddenSlotIds.includes(`manual:${manualSlot.id}`)) {
      return
    }
    const course = coursesById.get(manualSlot.courseId)
    if (!course) {
      return
    }
    const title = cleanCourseTitle(course.title, course.number)
    const timeRange = calendarTimeRange(manualSlot.time)
    if (!timeRange) {
      return
    }
    const firstOccurrence = firstWeekdayOnOrAfter(
      lecturePeriod.start,
      JS_DAY_INDEX[manualSlot.day],
    )
    const lines = [
      'BEGIN:VEVENT',
      `UID:manual-${manualSlot.id}@studyplanner`,
      `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(firstOccurrence, timeRange.startMinutes)}`,
      `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(firstOccurrence, timeRange.endMinutes)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAY[manualSlot.day]};UNTIL=${defaultUntilValue}`,
      `SUMMARY:${escapeIcsText(title)}`,
    ]
    if (manualSlot.room) {
      lines.push(`LOCATION:${escapeIcsText(manualSlot.room)}`)
    }
    lines.push('END:VEVENT')
    events.push(lines.join('\r\n'))
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyPlanner//Semester Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`StudyPlanner ${semesterLabel}`)}`,
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

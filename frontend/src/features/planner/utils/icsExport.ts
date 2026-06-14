import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'
import type { Course } from '../../courses'
import { getLecturePeriod } from './lecturePeriod.ts'
import { DAY_ORDER, isSingleDateSlot, normalizeWeekday, parseTimeRange } from './plannerFeedback.ts'

type Weekday = (typeof DAY_ORDER)[number]

const ICAL_DAY: Record<Weekday, string> = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
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
  const hours = Math.floor(minutesOfDay / 60)
  const minutes = minutesOfDay % 60
  return `${formatIcsDate(date)}T${pad(hours)}${pad(minutes)}00`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function firstWeekdayOnOrAfter(start: Date, weekdayIndex: number): Date {
  const result = new Date(start)
  const offset = (weekdayIndex - result.getDay() + 7) % 7
  result.setDate(result.getDate() + offset)
  return result
}

// Exam dates arrive either as ISO dates or in German notation.
function parseExamDate(value: string): Date | null {
  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }
  const germanMatch = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (germanMatch) {
    return new Date(Number(germanMatch[3]), Number(germanMatch[2]) - 1, Number(germanMatch[1]))
  }
  return null
}

// Single-date slot labels may carry surrounding text ("am 28.07.2026").
function parseGermanDateAnywhere(value: string): Date | null {
  const match = value.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/)
  if (!match) {
    return null
  }
  const rawYear = Number(match[3])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  return new Date(year, Number(match[2]) - 1, Number(match[1]))
}

interface SemesterIcsInput {
  semesterLabel: string
  courses: Course[]
  hiddenSlotIds: string[]
}

/**
 * Builds an iCalendar file for the planned semester: one weekly recurring
 * event per schedule slot across the lecture period, plus single events for
 * published exam dates. Returns null when the semester label is unparseable.
 */
export function buildSemesterPlanIcs({
  semesterLabel,
  courses,
  hiddenSlotIds,
}: SemesterIcsInput): string | null {
  const lecturePeriod = getLecturePeriod(semesterLabel)
  if (!lecturePeriod) {
    return null
  }

  const untilValue = `${formatIcsDate(lecturePeriod.end)}T215959Z`
  const events: string[] = []

  courses.forEach((course) => {
    const title = cleanCourseTitle(course.title, course.number)

    course.schedule.forEach((slot, index) => {
      if (hiddenSlotIds.includes(`${course.id}:${index}`)) {
        return
      }
      const timeRange = parseTimeRange(slot.time)

      // One-off appointments (exam dates) become a single event instead of a
      // weekly recurrence.
      if (isSingleDateSlot(slot.day)) {
        const slotDate = parseExamDate(slot.day) ?? parseGermanDateAnywhere(slot.day)
        if (!slotDate || !timeRange) {
          return
        }
        const lines = [
          'BEGIN:VEVENT',
          `UID:${course.id}-${index}@studyplanner`,
          `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(slotDate, timeRange.startMinutes)}`,
          `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(slotDate, timeRange.endMinutes)}`,
          `SUMMARY:${escapeIcsText(title)}`,
        ]
        if (slot.room && slot.room !== 'TBA') {
          lines.push(`LOCATION:${escapeIcsText(slot.room)}`)
        }
        lines.push('END:VEVENT')
        events.push(lines.join('\r\n'))
        return
      }

      const weekday = normalizeWeekday(slot.day)
      if (!weekday || !timeRange) {
        return
      }

      const firstOccurrence = firstWeekdayOnOrAfter(lecturePeriod.start, JS_DAY_INDEX[weekday])
      const summary = slot.type && slot.type !== 'Course' ? `${title} (${slot.type})` : title
      const lines = [
        'BEGIN:VEVENT',
        `UID:${course.id}-${index}@studyplanner`,
        `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(firstOccurrence, timeRange.startMinutes)}`,
        `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(firstOccurrence, timeRange.endMinutes)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAY[weekday]};UNTIL=${untilValue}`,
        `SUMMARY:${escapeIcsText(summary)}`,
      ]
      if (slot.room && slot.room !== 'TBA') {
        lines.push(`LOCATION:${escapeIcsText(slot.room)}`)
      }
      lines.push('END:VEVENT')
      events.push(lines.join('\r\n'))
    })

    course.exams.forEach((exam, index) => {
      const examDate = parseExamDate(exam.date)
      if (!examDate) {
        return
      }
      const dayAfter = new Date(examDate)
      dayAfter.setDate(dayAfter.getDate() + 1)
      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${course.id}-exam-${index}@studyplanner`,
          `DTSTART;VALUE=DATE:${formatIcsDate(examDate)}`,
          `DTEND;VALUE=DATE:${formatIcsDate(dayAfter)}`,
          `SUMMARY:${escapeIcsText(`${title} – ${exam.type}`)}`,
          'END:VEVENT',
        ].join('\r\n'),
      )
    })
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyPlanner//Semester Plan//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

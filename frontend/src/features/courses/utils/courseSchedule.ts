import { isSingleDateSlot } from '../../planner/utils/plannerFeedback.ts'
import { isTutorialLikeSlotType } from '../../planner/utils/plannerSlotSelection.ts'
import type { SupportedLanguage } from '../../i18n/index.ts'
import type { CourseExam, ScheduleSlot } from '../types.ts'
import { parseDateSortValue } from './examLabels.ts'
import { getScheduleSlotKind } from './scheduleSlotKind.ts'

export interface IndexedScheduleSlot {
  slot: ScheduleSlot
  index: number
}

export interface CourseScheduleParts {
  recurringSessions: IndexedScheduleSlot[]
  tutorialOptions: IndexedScheduleSlot[]
  examAppointments: IndexedScheduleSlot[]
  otherAppointments: IndexedScheduleSlot[]
}

function hasPublishedValue(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && value?.trim().toLowerCase() !== 'tba'
}

export function buildScheduleSlotSecondaryDetails(slot: ScheduleSlot): string[] {
  return [slot.timeNote, slot.note]
    .filter(hasPublishedValue)
    .filter((value, index, values) => values.indexOf(value) === index)
}

function isTutorialSlot(slot: ScheduleSlot): boolean {
  return isTutorialLikeSlotType(
    [slot.type, slot.groupType, slot.groupTitle].filter(Boolean).join(' '),
  )
}

export function partitionCourseSchedule(schedule: readonly ScheduleSlot[]): CourseScheduleParts {
  const result: CourseScheduleParts = {
    recurringSessions: [],
    tutorialOptions: [],
    examAppointments: [],
    otherAppointments: [],
  }

  schedule.forEach((slot, index) => {
    const entry = { slot, index }
    if (slot.calendarRelevant === false) {
      result.otherAppointments.push(entry)
      return
    }
    if (!isSingleDateSlot(slot.day)) {
      if (isTutorialSlot(slot)) {
        result.tutorialOptions.push(entry)
      } else {
        result.recurringSessions.push(entry)
      }
      return
    }
    const kind = getScheduleSlotKind(slot)
    if (kind === 'exam' || kind === 'resit') {
      result.examAppointments.push(entry)
    } else {
      result.otherAppointments.push(entry)
    }
  })

  return result
}

export interface ExamDisplayEntry {
  key: string
  type: string
  date: string
  time: string
  room: string
  duration: string
}

export function buildExamDisplayEntries(
  examAppointments: readonly IndexedScheduleSlot[],
  exams: readonly CourseExam[],
): ExamDisplayEntry[] {
  const entries: ExamDisplayEntry[] = []
  const seen = new Set<string>()
  const appointmentEntryByKey = new Map<string, ExamDisplayEntry>()
  const appointmentRoomsByKey = new Map<string, Set<string>>()

  for (const { slot, index } of examAppointments) {
    const dateSortValue = parseDateSortValue(slot.day)
    const dateKey = dateSortValue === null ? slot.day.trim().toLowerCase() : String(dateSortValue)
    const key = [dateKey, slot.time.trim(), slot.type.trim()].join('|').toLowerCase()
    const room = hasPublishedValue(slot.room) ? slot.room.trim() : ''
    const existingEntry = appointmentEntryByKey.get(key)
    if (existingEntry) {
      const rooms = appointmentRoomsByKey.get(key)
      if (room && rooms) {
        rooms.add(room)
        existingEntry.room = [...rooms].join(' · ')
      }
      continue
    }

    const rooms = new Set(room ? [room] : [])
    const entry: ExamDisplayEntry = {
      key: `slot-${slot.id ?? index}-${key}`,
      type: slot.type,
      date: slot.day,
      time: slot.time,
      room,
      duration: '',
    }
    seen.add(key)
    appointmentEntryByKey.set(key, entry)
    appointmentRoomsByKey.set(key, rooms)
    entries.push(entry)
  }

  for (const [index, exam] of exams.entries()) {
    const examDateValue = parseDateSortValue(exam.date)
    const isAlreadyTimed = entries.some((entry) => {
      const entryDateValue = parseDateSortValue(entry.date)
      return examDateValue !== null && entryDateValue === examDateValue
    })
    if (isAlreadyTimed) continue
    const key = [exam.date, exam.type, exam.duration].join('|').toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      key: `exam-${index}-${key}`,
      type: exam.type,
      date: exam.date,
      time: '',
      room: '',
      duration: exam.duration,
    })
  }

  return entries
}

export function formatCancellationDates(
  dates: readonly string[],
  language: SupportedLanguage,
): string {
  const formatter = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: language === 'de' ? '2-digit' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return dates.map((date) => {
    const timestamp = parseDateSortValue(date)
    return timestamp === null ? date : formatter.format(new Date(timestamp))
  }).join(', ')
}

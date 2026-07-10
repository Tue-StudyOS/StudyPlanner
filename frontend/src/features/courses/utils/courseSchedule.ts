import { isSingleDateSlot } from '../../planner/utils/plannerFeedback.ts'
import { isTutorialLikeSlotType } from '../../planner/utils/plannerSlotSelection.ts'
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

  for (const { slot, index } of examAppointments) {
    const key = [slot.day, slot.time, slot.room, slot.type].join('|').toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      key: `slot-${slot.id ?? index}-${key}`,
      type: slot.type,
      date: slot.day,
      time: slot.time,
      room: slot.room,
      duration: '',
    })
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

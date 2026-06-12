import {
  DAY_ORDER,
  normalizeWeekday,
  parseTimeRange,
} from '../../planner/utils/plannerFeedback.ts'
import type { Course } from '../types'

export type FilterWeekday = (typeof DAY_ORDER)[number]

export interface TimeWindowFilter {
  // Minutes since midnight; null means unbounded on that side.
  startMinutes: number | null
  endMinutes: number | null
}

export function parseTimeInputToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) {
    return null
  }
  return hours * 60 + minutes
}

/**
 * A course matches when at least one schedule slot falls on one of the selected
 * weekdays AND lies completely inside the selected time window. Courses without
 * parseable slots never match an active day/time filter — exact filters are
 * meant to answer "what can I attend at this time".
 */
export function courseMatchesTimeFilter(
  course: Pick<Course, 'schedule'>,
  selectedDays: FilterWeekday[],
  timeWindow: TimeWindowFilter,
): boolean {
  const hasDayFilter = selectedDays.length > 0
  const hasTimeFilter = timeWindow.startMinutes !== null || timeWindow.endMinutes !== null
  if (!hasDayFilter && !hasTimeFilter) {
    return true
  }

  return course.schedule.some((slot) => {
    const slotDay = normalizeWeekday(slot.day)
    if (hasDayFilter && (slotDay === null || !selectedDays.includes(slotDay))) {
      return false
    }

    if (!hasTimeFilter) {
      return true
    }

    const slotTime = parseTimeRange(slot.time)
    if (!slotTime) {
      return false
    }
    if (timeWindow.startMinutes !== null && slotTime.startMinutes < timeWindow.startMinutes) {
      return false
    }
    if (timeWindow.endMinutes !== null && slotTime.endMinutes > timeWindow.endMinutes) {
      return false
    }
    return true
  })
}

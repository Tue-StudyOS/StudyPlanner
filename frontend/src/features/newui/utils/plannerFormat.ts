import { normalizeWeekday, parseTimeRange } from '../../planner/utils/plannerFeedback.ts'

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mo',
  Tuesday: 'Di',
  Wednesday: 'Mi',
  Thursday: 'Do',
  Friday: 'Fr',
}

function formatHour(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return minute === 0 ? String(hour) : `${hour}:${String(minute).padStart(2, '0')}`
}

/**
 * Compacts a tutorial-slot label ("Mo · 14:00-16:00 · A101") to just weekday and
 * hour range ("Mo 14-16").
 */
export function formatTutorialSlotLabel(label: string): string {
  const [dayPart = '', timePart = ''] = label.split(' · ')
  const day = normalizeWeekday(dayPart)
  const dayShort = day ? DAY_SHORT[day] : dayPart.trim()
  const range = parseTimeRange(timePart)
  const time = range ? `${formatHour(range.startMinutes)}-${formatHour(range.endMinutes)}` : timePart.trim()
  return [dayShort, time].filter(Boolean).join(' ')
}

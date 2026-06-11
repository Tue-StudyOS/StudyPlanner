import type { Course } from '../../courses'

export const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

export const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
}

const DAY_ALIASES: Record<string, (typeof DAY_ORDER)[number]> = {
  mo: 'Monday',
  'mo.': 'Monday',
  mon: 'Monday',
  monday: 'Monday',
  montag: 'Monday',
  di: 'Tuesday',
  'di.': 'Tuesday',
  tue: 'Tuesday',
  tuesday: 'Tuesday',
  dienstag: 'Tuesday',
  mi: 'Wednesday',
  'mi.': 'Wednesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  mittwoch: 'Wednesday',
  do: 'Thursday',
  'do.': 'Thursday',
  thu: 'Thursday',
  thursday: 'Thursday',
  donnerstag: 'Thursday',
  fr: 'Friday',
  'fr.': 'Friday',
  fri: 'Friday',
  friday: 'Friday',
  freitag: 'Friday',
}

export interface PlannerBlock {
  blockId: string
  slotId: string
  courseId: string
  courseTitle: string
  day: (typeof DAY_ORDER)[number]
  startMinutes: number
  endMinutes: number
  label: string
  room: string
  hasOverlap: boolean
}

function normalizeWeekday(value: string): (typeof DAY_ORDER)[number] | null {
  return DAY_ALIASES[value.trim().toLowerCase()] ?? null
}

function parseTimeRange(timeText: string): { startMinutes: number; endMinutes: number } | null {
  const match = timeText.match(/(\d{1,2}:\d{2})\s*(?:-|\u2013|\u2014)\s*(\d{1,2}:\d{2})/)
  if (!match) {
    return null
  }

  const [startHour, startMinute] = match[1].split(':').map(Number)
  const [endHour, endMinute] = match[2].split(':').map(Number)
  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  }
}

export function buildPlannerBlocks(courses: Course[]): PlannerBlock[] {
  const blocks: PlannerBlock[] = []

  courses.forEach((course) => {
    course.schedule.forEach((slot, index) => {
      const normalizedDay = normalizeWeekday(slot.day)
      const timeRange = parseTimeRange(slot.time)
      if (!normalizedDay || !timeRange) {
        return
      }
      blocks.push({
        blockId: `${course.id}-${index}`,
        slotId: `${course.id}:${index}`,
        courseId: course.id,
        courseTitle: course.title,
        day: normalizedDay,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
        label: slot.time,
        room: slot.room,
        hasOverlap: false,
      })
    })
  })

  return blocks
    .map((block) => {
      const hasOverlap = blocks.some((candidate) => {
        if (candidate.blockId === block.blockId || candidate.day !== block.day) {
          return false
        }
        return candidate.startMinutes < block.endMinutes && block.startMinutes < candidate.endMinutes
      })
      return { ...block, hasOverlap }
    })
    .sort((left, right) => {
      const dayDifference = DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day)
      if (dayDifference !== 0) {
        return dayDifference
      }
      return left.startMinutes - right.startMinutes
    })
}

import type { Course } from '../../courses'
import { DAY_LABELS, isSingleDateSlot, normalizeWeekday } from './plannerFeedback.ts'
import { getScheduleSlotId, getScheduleSlotLegacyIds } from './scheduleSlotIds.ts'

const TUTORIAL_SLOT_PATTERN = /tutorium|übung|uebung|exercise|tutorial/i
// Combined course types like "Vorlesung/Übung" carry no per-slot role; such slots
// must default to lecture (always attended), not to a choosable tutorial.
const LECTURE_SLOT_PATTERN = /vorlesung|lecture/i

export function isTutorialLikeSlotType(slotType: string): boolean {
  const normalized = slotType.trim()
  return TUTORIAL_SLOT_PATTERN.test(normalized) && !LECTURE_SLOT_PATTERN.test(normalized)
}

export interface PlannerSlotOption {
  slotId: string
  legacySlotIds: string[]
  label: string
  dayLabel: string
  time: string
  timeLabel: string
  room: string
  kind: 'lecture' | 'tutorial'
}

export interface TutorialSlotSelectLayout {
  dayWidthCh: number
  timeWidthCh: number
  roomWidthCh: number
}

function formatTimeRange(time: string): string {
  const match = time.match(/(\d{1,2}:\d{2})\s*(?:-|–|—)\s*(\d{1,2}:\d{2})/)
  if (!match) {
    return time.trim()
  }
  const normalizeClock = (clock: string): string => {
    const [hour, minute] = clock.split(':')
    return `${hour.padStart(2, '0')}:${minute}`
  }
  return `${normalizeClock(match[1])}–${normalizeClock(match[2])}`
}

export function formatPlannerSlotRoom(room: string): string {
  return room.replace(/\s*\([^)]*\).*$/, '').trim()
}

function formatSlotLabel(dayLabel: string, timeLabel: string, room: string): string {
  return [dayLabel, timeLabel, room].filter(Boolean).join(' ')
}

function isWeeklyScheduleSlot(slot: Course['schedule'][number]): boolean {
  return slot.calendarRelevant !== false && !isSingleDateSlot(slot.day)
}

/**
 * Uses ALMA's appointment/group role instead of guessing from the number of
 * weekly slots. This keeps courses with several lecture meetings intact while
 * exposing every real exercise/tutorial alternative.
 */
export function getPlannerSlotOptions(course: Course): PlannerSlotOption[] {
  const slotRows = course.schedule
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isWeeklyScheduleSlot(slot))
    .map(({ slot, index }) => {
      const normalizedDay = normalizeWeekday(slot.day)
      return {
        slot,
        index,
        dayLabel: normalizedDay ? DAY_LABELS[normalizedDay] : slot.day,
      }
    })

  return slotRows.map(({ slot, index, dayLabel }) => {
    const roleText = [slot.type, slot.groupType, slot.groupTitle].filter(Boolean).join(' ')
    const timeLabel = formatTimeRange(slot.time)
    const room = formatPlannerSlotRoom(slot.room)
    return {
      slotId: getScheduleSlotId(course, slot, index),
      legacySlotIds: getScheduleSlotLegacyIds(course, slot, index),
      label: formatSlotLabel(dayLabel, timeLabel, room),
      dayLabel,
      time: slot.time,
      timeLabel,
      room,
      kind: isTutorialLikeSlotType(roleText) ? 'tutorial' : 'lecture',
    }
  })
}

export function getTutorialSlotOptions(course: Course): PlannerSlotOption[] {
  return getPlannerSlotOptions(course).filter((option) => option.kind === 'tutorial')
}

export function buildTutorialSlotSelectLayout(
  courses: readonly Course[],
): TutorialSlotSelectLayout {
  const options = courses.flatMap((course) => {
    const tutorialOptions = getTutorialSlotOptions(course)
    return tutorialOptions.length > 1 ? tutorialOptions : []
  })
  return {
    dayWidthCh: Math.max(3, ...options.map((option) => option.dayLabel.length)),
    timeWidthCh: Math.max(11, ...options.map((option) => option.timeLabel.length)),
    roomWidthCh: Math.max(1, ...options.map((option) => (option.room || '—').length)),
  }
}

export function hiddenSlotIdsForTutorialSelection(
  allTutorialSlotIds: readonly string[],
  selectedSlotId: string,
): string[] {
  return allTutorialSlotIds.filter((slotId) => slotId !== selectedSlotId)
}

export function defaultHiddenTutorialSlotIds(options: readonly PlannerSlotOption[]): string[] {
  if (options.length <= 1) {
    return []
  }
  return options.slice(1).map((option) => option.slotId)
}

export function applyDefaultTutorialSlotSelection(
  courses: readonly Course[],
  hiddenSlotIds: readonly string[],
): string[] {
  const nextHiddenSlotIds = [...hiddenSlotIds]
  for (const course of courses) {
    const options = getTutorialSlotOptions(course)
    const hasStoredSelection = options.some(
      (option) =>
        hiddenSlotIds.includes(option.slotId)
        || option.legacySlotIds.some((legacyId) => hiddenSlotIds.includes(legacyId)),
    )
    if (!hasStoredSelection) {
      nextHiddenSlotIds.push(...defaultHiddenTutorialSlotIds(options))
    }
  }
  return [...new Set(nextHiddenSlotIds)]
}

export function resolveVisibleTutorialSlotId(
  options: readonly PlannerSlotOption[],
  hiddenSlotIds: readonly string[],
): string | null {
  if (options.length === 0) {
    return null
  }
  const visible = options.find(
    (option) =>
      !hiddenSlotIds.includes(option.slotId)
      && !option.legacySlotIds.some((legacyId) => hiddenSlotIds.includes(legacyId)),
  )
  return visible?.slotId ?? options[0]?.slotId ?? null
}

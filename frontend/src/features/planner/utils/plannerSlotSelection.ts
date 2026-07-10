import type { Course } from '../../courses'
import { isSingleDateSlot } from './plannerFeedback.ts'
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
  kind: 'lecture' | 'tutorial'
}

function formatSlotLabel(slot: Course['schedule'][number]): string {
  return [slot.day, slot.time, slot.room].filter(Boolean).join(' · ')
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
  return course.schedule
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isWeeklyScheduleSlot(slot))
    .map(({ slot, index }) => {
      const roleText = [slot.type, slot.groupType, slot.groupTitle].filter(Boolean).join(' ')
      return {
        slotId: getScheduleSlotId(course, slot, index),
        legacySlotIds: getScheduleSlotLegacyIds(course, slot, index),
        label: formatSlotLabel(slot),
        kind: isTutorialLikeSlotType(roleText) ? 'tutorial' : 'lecture',
      }
    })
}

export function getTutorialSlotOptions(course: Course): PlannerSlotOption[] {
  return getPlannerSlotOptions(course).filter((option) => option.kind === 'tutorial')
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

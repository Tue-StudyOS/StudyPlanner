import type { Course } from '../../courses'
import { isSingleDateSlot } from './plannerFeedback.ts'

const TUTORIAL_SLOT_PATTERN = /tutorium|übung|uebung|exercise|tutorial/i

export function isTutorialLikeSlotType(slotType: string): boolean {
  return TUTORIAL_SLOT_PATTERN.test(slotType.trim())
}

export interface PlannerSlotOption {
  slotId: string
  label: string
}

export function getTutorialSlotOptions(course: Course): PlannerSlotOption[] {
  return course.schedule
    .map((slot, index) => ({ slot, index }))
    .filter(
      ({ slot }) =>
        !isSingleDateSlot(slot.day)
        && isTutorialLikeSlotType(slot.type !== 'Course' ? slot.type : ''),
    )
    .map(({ slot, index }) => ({
      slotId: `${course.id}:${index}`,
      label: [slot.day, slot.time, slot.room].filter(Boolean).join(' · '),
    }))
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
  const visible = options.find((option) => !hiddenSlotIds.includes(option.slotId))
  return visible?.slotId ?? options[0]?.slotId ?? null
}

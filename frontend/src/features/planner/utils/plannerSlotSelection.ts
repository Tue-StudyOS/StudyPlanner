import type { Course } from '../../courses'
import { isSingleDateSlot } from './plannerFeedback.ts'

const TUTORIAL_SLOT_PATTERN = /tutorium|übung|uebung|exercise|tutorial/i
const MAX_LECTURE_SLOTS = 2

export function isTutorialLikeSlotType(slotType: string): boolean {
  return TUTORIAL_SLOT_PATTERN.test(slotType.trim())
}

export interface PlannerSlotOption {
  slotId: string
  label: string
  kind: 'lecture' | 'tutorial'
}

function formatSlotLabel(slot: Course['schedule'][number]): string {
  return [slot.day, slot.time, slot.room].filter(Boolean).join(' · ')
}

function isWeeklyScheduleSlot(slot: Course['schedule'][number]): boolean {
  return !isSingleDateSlot(slot.day)
}

/**
 * Classifies weekly slots: the first one or two non-tutorial appointments are
 * treated as lectures; everything else (explicit tutorials plus overflow slots)
 * is selectable as a tutorial alternative.
 */
export function getPlannerSlotOptions(course: Course): PlannerSlotOption[] {
  const weeklySlots = course.schedule
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isWeeklyScheduleSlot(slot))

  let lectureSlotsRemaining = MAX_LECTURE_SLOTS
  return weeklySlots.map(({ slot, index }) => {
    const slotType = slot.type !== 'Course' ? slot.type : ''
    const isExplicitTutorial = isTutorialLikeSlotType(slotType)
    const isLecture = !isExplicitTutorial && lectureSlotsRemaining > 0
    if (isLecture) {
      lectureSlotsRemaining -= 1
    }
    return {
      slotId: `${course.id}:${index}`,
      label: formatSlotLabel(slot),
      kind: isLecture ? 'lecture' : 'tutorial',
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
  const visible = options.find((option) => !hiddenSlotIds.includes(option.slotId))
  return visible?.slotId ?? options[0]?.slotId ?? null
}

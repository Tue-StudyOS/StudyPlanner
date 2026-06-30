import { isSingleDateSlot } from '../../planner/utils/plannerFeedback.ts'
import type { ScheduleSlot } from '../types.ts'

export type ScheduleSlotKind = 'weekly' | 'exam' | 'resit'

const EXAM_PATTERN = /\b(klausur|pruefung|prüfung|exam)\b/i
const RESIT_PATTERN = /\b(nachklausur|resit)\b/i

export function getScheduleSlotKind(slot: ScheduleSlot): ScheduleSlotKind {
  const slotType = slot.type.trim()
  if (RESIT_PATTERN.test(slotType)) return 'resit'
  if (EXAM_PATTERN.test(slotType)) return 'exam'
  if (isSingleDateSlot(slot.day)) return 'exam'
  return 'weekly'
}

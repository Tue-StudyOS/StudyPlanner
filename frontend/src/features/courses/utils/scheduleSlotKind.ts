import { isSingleDateSlot } from '../../planner/utils/plannerFeedback.ts'
import type { ScheduleSlot } from '../types.ts'

export type ScheduleSlotKind = 'weekly' | 'exam' | 'resit'

const EXAM_PATTERN = /\b(klausur|pruefung|prüfung|exam)\b/i
const RESIT_PATTERN = /\b(nachklausur|resit)\b/i
const SESSION_TYPE_PATTERN =
  /(vorlesung|übung|uebung|lecture|exercise|seminar|praktikum|tutorial|tutorium|kolloquium)/i

function isSessionSlotType(slotType: string): boolean {
  return SESSION_TYPE_PATTERN.test(slotType.trim())
}

export function getScheduleSlotKind(slot: ScheduleSlot): ScheduleSlotKind {
  const slotType = slot.type.trim()
  if (RESIT_PATTERN.test(slotType)) return 'resit'
  if (EXAM_PATTERN.test(slotType)) return 'exam'
  if (isSingleDateSlot(slot.day)) {
    if (!slotType || slotType === 'Course' || !isSessionSlotType(slotType)) {
      return 'exam'
    }
    return 'weekly'
  }
  return 'weekly'
}

export function getScheduleSlotTypeLabel(slot: ScheduleSlot): string {
  const kind = getScheduleSlotKind(slot)
  if (kind === 'resit') return 'Nachklausur'
  if (kind === 'exam') return 'Klausur'
  const raw = slot.type.trim()
  if (raw && raw !== 'Course' && /[\p{L}\p{N}]/u.test(raw)) {
    return raw
  }
  return ''
}

export function scheduleSlotBlockClasses(
  slotKind: ScheduleSlotKind,
  _hasOverlap: boolean,
  sessionRole: 'lecture' | 'tutorial' | 'other' = 'other',
): string {
  if (slotKind === 'exam' || slotKind === 'resit') {
    return 'border-amber-500/55 bg-amber-500/20 text-amber-950 dark:text-amber-50'
  }
  if (sessionRole === 'lecture') {
    return 'border-border-light bg-surface text-fg dark:bg-surface-hover/35'
  }
  if (sessionRole === 'tutorial') {
    return 'border-border bg-surface-hover/60 text-fg dark:bg-surface-hover/75'
  }
  return 'border-border bg-surface text-fg dark:bg-surface-hover'
}

export function scheduleSlotDotClasses(slotKind: ScheduleSlotKind): string {
  if (slotKind === 'exam' || slotKind === 'resit') return 'bg-amber-500'
  return 'bg-primary'
}

export function scheduleSlotGridBlockClasses(slotKind: ScheduleSlotKind): string {
  if (slotKind === 'exam' || slotKind === 'resit') return 'border-amber-500/60 bg-amber-500/30'
  return 'border-primary/70 bg-primary/35'
}

export function scheduleSlotListLabelClasses(
  slotKind: ScheduleSlotKind,
  sessionRole: 'lecture' | 'tutorial' | 'other' = 'other',
): string {
  if (slotKind === 'exam' || slotKind === 'resit') return 'text-amber-600 dark:text-amber-400'
  if (sessionRole === 'lecture') return 'text-fg-mid'
  if (sessionRole === 'tutorial') return 'text-fg-muted'
  return 'text-fg-muted'
}

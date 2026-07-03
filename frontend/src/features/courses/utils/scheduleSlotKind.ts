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
  hasOverlap: boolean,
): string {
  if (slotKind === 'exam') {
    return hasOverlap
      ? 'border-amber-700 bg-amber-600/55 text-amber-950 dark:border-amber-500 dark:bg-amber-600/40 dark:text-amber-100'
      : 'border-amber-700/90 bg-amber-600/45 text-amber-950 dark:border-amber-500/80 dark:bg-amber-600/35 dark:text-amber-100'
  }
  if (slotKind === 'resit') {
    return hasOverlap
      ? 'border-amber-900 bg-amber-800/55 text-amber-50 dark:border-amber-700 dark:bg-amber-800/45 dark:text-amber-100'
      : 'border-amber-900/90 bg-amber-800/45 text-amber-50 dark:border-amber-700/80 dark:bg-amber-800/35 dark:text-amber-100'
  }
  return hasOverlap
    ? 'border-primary/40 bg-primary/10 text-primary'
    : 'border-border bg-surface text-fg dark:bg-surface-hover'
}

export function scheduleSlotDotClasses(slotKind: ScheduleSlotKind): string {
  if (slotKind === 'exam') return 'bg-amber-600'
  if (slotKind === 'resit') return 'bg-amber-800 dark:bg-amber-700'
  return 'bg-primary'
}

export function scheduleSlotGridBlockClasses(slotKind: ScheduleSlotKind): string {
  if (slotKind === 'exam') return 'border-amber-700/80 bg-amber-600/40 dark:bg-amber-600/30'
  if (slotKind === 'resit') return 'border-amber-900/85 bg-amber-800/45 dark:bg-amber-800/35'
  return 'border-primary/70 bg-primary/35'
}

export function scheduleSlotListLabelClasses(slotKind: ScheduleSlotKind): string {
  if (slotKind === 'exam') return 'font-medium text-amber-900 dark:text-amber-300'
  if (slotKind === 'resit') return 'font-medium text-amber-950 dark:text-amber-400'
  return 'text-fg-muted'
}

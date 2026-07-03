import type { CourseParallelGroup } from '../../courses'
import { DAY_LABELS, normalizeWeekday } from './plannerFeedback.ts'

/**
 * A one-line "when / where" summary of a parallel group for the picker, e.g.
 * "Monday 14:00 - 16:00 · Thursday 14:00 - 16:00". Duplicate slots (the same
 * meeting listed in several rooms) collapse to one entry.
 */
export function summarizeGroupSchedule(group: CourseParallelGroup): string {
  const parts = group.schedule
    .map((slot) => {
      const normalizedDay = normalizeWeekday(slot.day)
      const dayLabel = normalizedDay ? DAY_LABELS[normalizedDay] : slot.day.trim()
      const time = slot.time && slot.time !== 'TBA' ? slot.time.trim() : ''
      return [dayLabel, time].filter(Boolean).join(' ')
    })
    .filter((part) => part.length > 0)
  const unique = Array.from(new Set(parts))
  return unique.length > 0 ? unique.join(' · ') : 'No weekly time yet'
}

/** The primary room of a group, or an empty string when none is known. */
export function summarizeGroupRoom(group: CourseParallelGroup): string {
  const room = group.schedule
    .map((slot) => slot.room)
    .find((value) => value && value !== 'TBA')
  return room ?? ''
}

/** Seat range for a group, e.g. "max 30", "5–30", or "" when unknown. */
export function summarizeGroupSeats(group: CourseParallelGroup): string {
  const { minParticipants, maxParticipants } = group
  if (minParticipants !== null && maxParticipants !== null) {
    return `${minParticipants}–${maxParticipants} seats`
  }
  if (maxParticipants !== null) {
    return `max ${maxParticipants} seats`
  }
  if (minParticipants !== null) {
    return `min ${minParticipants} seats`
  }
  return ''
}
